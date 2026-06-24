-- Phase 2: Add indexes, constraints, updatedAt fields, and onDelete cascade

-- Step 1: Add updatedAt columns with default value for existing rows
ALTER TABLE "appointments" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "messages" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Add onDelete CASCADE to appointments foreign keys
-- Drop existing foreign keys and recreate with CASCADE
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_patient_id_fkey";
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_doctor_id_fkey";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 3: Add indexes for query performance
CREATE INDEX "schedules_doctor_id_idx" ON "schedules"("doctor_id");
CREATE INDEX "appointments_patient_id_idx" ON "appointments"("patient_id");
CREATE INDEX "appointments_doctor_id_idx" ON "appointments"("doctor_id");
CREATE INDEX "appointments_status_date_idx" ON "appointments"("status", "date");
CREATE INDEX "messages_sender_id_receiver_id_idx" ON "messages"("sender_id", "receiver_id");
CREATE INDEX "messages_receiver_id_sender_id_idx" ON "messages"("receiver_id", "sender_id");
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- Step 4: Add unique constraint on Schedule (doctor + day)
-- First remove any duplicate entries, keeping only the latest one per doctor+day
DELETE FROM "schedules" a USING "schedules" b
WHERE a.id < b.id AND a.doctor_id = b.doctor_id AND a.day_of_week = b.day_of_week;

CREATE UNIQUE INDEX "unique_doctor_day" ON "schedules"("doctor_id", "day_of_week");
