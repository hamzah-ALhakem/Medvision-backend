// Phase 1 Verification Test Script
// Run with: node test-phase1.js (while server is running on port 5000)

const BASE = 'http://localhost:5000/api';
let passed = 0;
let failed = 0;
let adminToken = null;
let patientToken = null;

async function request(method, path, body = null, token = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

function test(name, condition) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ FAILED: ${name}`);
        failed++;
    }
}

async function run() {
    console.log('\n🔒 PHASE 1: SECURITY LOCKDOWN — Verification Tests\n');
    console.log('='.repeat(55));

    // --- 1. Login to get tokens ---
    console.log('\n📋 Setup: Getting tokens...');

    const adminLogin = await request('POST', '/auth/login', { 
        email: 'admin@medvision.com', password: 'password123' 
    });
    adminToken = adminLogin.data.token;
    test('Admin login successful', adminLogin.status === 200 && adminToken);

    const patientReg = await request('POST', '/auth/register', {
        fullName: 'Test Patient',
        email: `testpatient_${Date.now()}@test.com`,
        password: 'testpassword123',
        role: 'patient',
        gender: 'Male'
    });
    patientToken = patientReg.data.token;
    test('Patient registration successful', patientReg.status === 201 && patientToken);

    // --- 2. RBAC Tests ---
    console.log('\n🛡️  Test Group: RBAC (Role-Based Access Control)');
    console.log('-'.repeat(55));

    const adminStatsWithPatient = await request('GET', '/admin/stats', null, patientToken);
    test('Patient cannot access admin stats (403)', adminStatsWithPatient.status === 403);

    const adminStatsWithAdmin = await request('GET', '/admin/stats', null, adminToken);
    test('Admin CAN access admin stats (200)', adminStatsWithAdmin.status === 200);

    const pendingWithPatient = await request('GET', '/admin/doctors/pending', null, patientToken);
    test('Patient cannot list pending doctors (403)', pendingWithPatient.status === 403);

    const approveWithPatient = await request('PUT', '/admin/doctors/999/approve', null, patientToken);
    test('Patient cannot approve doctors (403)', approveWithPatient.status === 403);

    const adminStatsNoToken = await request('GET', '/admin/stats');
    test('No token -> admin stats rejected (401)', adminStatsNoToken.status === 401);

    // --- 3. Role Self-Elevation Block ---
    console.log('\n🚫 Test Group: Role Self-Elevation Prevention');
    console.log('-'.repeat(55));

    const adminReg = await request('POST', '/auth/register', {
        fullName: 'Hacker Admin',
        email: `hacker_${Date.now()}@evil.com`,
        password: 'hackerpassword123',
        role: 'ADMIN',
        gender: 'Male'
    });
    test('Cannot self-register as ADMIN (rejected by validator)', adminReg.status === 400);

    // --- 4. Password Hash Not Leaked ---
    console.log('\n🔑 Test Group: Password Hash Protection');
    console.log('-'.repeat(55));

    const regResponse = await request('POST', '/auth/register', {
        fullName: 'Hash Check User',
        email: `hashcheck_${Date.now()}@test.com`,
        password: 'securepassword123',
        gender: 'Female'
    });
    test('Registration response has NO password field', 
        regResponse.status === 201 && !regResponse.data.user?.password);

    const loginResponse = await request('POST', '/auth/login', {
        email: 'admin@medvision.com', password: 'password123'
    });
    test('Login response has NO password field', 
        loginResponse.status === 200 && !loginResponse.data.user?.password);

    // --- 5. Input Validation ---
    console.log('\n✏️  Test Group: Input Validation');
    console.log('-'.repeat(55));

    const noEmail = await request('POST', '/auth/register', {
        fullName: 'No Email', password: 'password123', gender: 'Male'
    });
    test('Register without email -> 400', noEmail.status === 400);

    const badEmail = await request('POST', '/auth/register', {
        fullName: 'Bad Email', email: 'not-an-email', password: 'password123', gender: 'Male'
    });
    test('Register with invalid email -> 400', badEmail.status === 400);

    const shortPass = await request('POST', '/auth/register', {
        fullName: 'Short Pass', email: `short_${Date.now()}@test.com`, password: '123', gender: 'Male'
    });
    test('Register with password < 8 chars -> 400', shortPass.status === 400);

    const emptyLogin = await request('POST', '/auth/login', {
        email: 'test@test.com'
    });
    test('Login without password -> 400', emptyLogin.status === 400);

    const badAppt = await request('POST', '/appointments', {
        doctorId: 'not-a-number', date: 'bad-date'
    }, patientToken);
    test('Create appointment with bad data -> 400', badAppt.status === 400);

    const badMsg = await request('POST', '/messages', {
        receiverId: 'abc', content: ''
    }, patientToken);
    test('Send message with invalid data -> 400', badMsg.status === 400);

    // --- 6. Doctor Role Enforcement ---
    console.log('\n👨‍⚕️ Test Group: Doctor Role Enforcement');
    console.log('-'.repeat(55));

    const patientUpdateStatus = await request('PUT', '/appointments/1/status', {
        status: 'confirmed'
    }, patientToken);
    test('Patient cannot update appointment status (403)', patientUpdateStatus.status === 403);

    const patientSchedule = await request('POST', '/schedule', {
        schedule: [{ day: 'Monday', startTime: '09:00', endTime: '17:00' }]
    }, patientToken);
    test('Patient cannot create schedule (403)', patientSchedule.status === 403);

    // --- 7. Messaging Permission Check ---
    console.log('\n💬 Test Group: Messaging Permission Enforcement');
    console.log('-'.repeat(55));

    const msgNoAppt = await request('POST', '/messages', {
        receiverId: 1, content: 'Hello doctor!'
    }, patientToken);
    test('Message without confirmed appointment -> 403', msgNoAppt.status === 403);

    // --- Summary ---
    console.log('\n' + '='.repeat(55));
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
    
    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! Phase 1 Security Lockdown is VERIFIED.\n');
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed. Review the output above.\n`);
    }
}

run().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
