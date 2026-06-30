import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendVerificationEmail = async (to, token) => {
    const url = `${process.env.FRONTEND_URL}/verify-email/${token}`;
    const mailOptions = {
        from: `"MedVision" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Verify your MedVision Account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h1 style="color: #2563eb; text-align: center;">Account Verification</h1>
                <p style="font-size: 16px; color: #333;">Welcome to MedVision! Please click the button below to verify your email address:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${url}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">Verify Email</a>
                </div>
                <p style="font-size: 14px; color: #666;">Or copy and paste this link in your browser:<br>
                <a href="${url}" style="color: #2563eb; word-break: break-all;">${url}</a></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #999; text-align: center;">If you did not create an account, no further action is required.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (to, token) => {
    const url = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    const mailOptions = {
        from: `"MedVision" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Reset your MedVision Password',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h1 style="color: #2563eb; text-align: center;">Password Reset</h1>
                <p style="font-size: 16px; color: #333;">You requested a password reset. Please click the button below to set a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${url}" style="display:inline-block;padding:12px 24px;background-color:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">Reset Password</a>
                </div>
                <p style="font-size: 14px; color: #666;">Or copy and paste this link in your browser:<br>
                <a href="${url}" style="color: #2563eb; word-break: break-all;">${url}</a></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #999; text-align: center;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};
