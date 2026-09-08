-- Sala de espera: entrada pendente aprovada pelo PO.
ALTER TABLE "RoomConfig" ADD COLUMN IF NOT EXISTS "requireJoinApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "RoomJoinRequest" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "avatar" TEXT,
  "requestedRole" "ParticipantRole" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "decidedByParticipantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "RoomJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RoomJoinRequest_roomId_status_idx" ON "RoomJoinRequest"("roomId", "status");

DO $$ BEGIN
  ALTER TABLE "RoomJoinRequest" ADD CONSTRAINT "RoomJoinRequest_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoomJoinRequest" ADD CONSTRAINT "RoomJoinRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoomJoinRequest" ADD CONSTRAINT "RoomJoinRequest_decidedByParticipantId_fkey"
  FOREIGN KEY ("decidedByParticipantId") REFERENCES "RoomParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RoomRemovedIdentity" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "removedByParticipantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomRemovedIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoomRemovedIdentity_roomId_userId_key" ON "RoomRemovedIdentity"("roomId", "userId");

DO $$ BEGIN
  ALTER TABLE "RoomRemovedIdentity" ADD CONSTRAINT "RoomRemovedIdentity_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoomRemovedIdentity" ADD CONSTRAINT "RoomRemovedIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RoomRemovedIdentity" ADD CONSTRAINT "RoomRemovedIdentity_removedByParticipantId_fkey"
  FOREIGN KEY ("removedByParticipantId") REFERENCES "RoomParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
