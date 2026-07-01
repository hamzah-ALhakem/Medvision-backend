/*
  Warnings:

  - You are about to drop the column `name` on the `lab_services` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `labs` table. All the data in the column will be lost.
  - You are about to drop the column `first_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `last_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `specialty` on the `users` table. All the data in the column will be lost.
  - Added the required column `name_ar` to the `lab_services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_en` to the `lab_services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_ar` to the `labs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_en` to the `labs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_name_ar` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_name_en` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name_ar` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name_en` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lab_services" DROP COLUMN "name",
ADD COLUMN     "name_ar" TEXT NOT NULL,
ADD COLUMN     "name_en" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "labs" DROP COLUMN "name",
ADD COLUMN     "name_ar" TEXT NOT NULL,
ADD COLUMN     "name_en" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "first_name",
DROP COLUMN "last_name",
DROP COLUMN "specialty",
ADD COLUMN     "first_name_ar" TEXT NOT NULL,
ADD COLUMN     "first_name_en" TEXT NOT NULL,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_name_ar" TEXT NOT NULL,
ADD COLUMN     "last_name_en" TEXT NOT NULL,
ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT,
ADD COLUMN     "specialty_ar" TEXT,
ADD COLUMN     "specialty_en" TEXT,
ADD COLUMN     "verificationToken" TEXT;

-- RenameIndex
ALTER INDEX "unique_doctor_day" RENAME TO "schedules_doctor_id_day_of_week_key";
