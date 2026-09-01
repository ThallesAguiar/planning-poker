-- Account auth and room membership reuse
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email") WHERE "email" IS NOT NULL;

ALTER TABLE "RoomParticipant" ADD COLUMN IF NOT EXISTS "roomDisplayName" TEXT;
ALTER TABLE "RoomParticipant" ADD COLUMN IF NOT EXISTS "roomAvatarUrl" TEXT;
ALTER TABLE "RoomParticipant" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "RoomRoleChangeRequest" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "requesterParticipantId" TEXT NOT NULL,
  "currentRole" "ParticipantRole" NOT NULL,
  "requestedRole" "ParticipantRole" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "decidedByParticipantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "RoomRoleChangeRequest_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "RoomRoleChangeRequest" ADD CONSTRAINT "RoomRoleChangeRequest_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoomRoleChangeRequest" ADD CONSTRAINT "RoomRoleChangeRequest_requesterParticipantId_fkey"
  FOREIGN KEY ("requesterParticipantId") REFERENCES "RoomParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoomRoleChangeRequest" ADD CONSTRAINT "RoomRoleChangeRequest_decidedByParticipantId_fkey"
  FOREIGN KEY ("decidedByParticipantId") REFERENCES "RoomParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
