-- AlterTable: RoomAiAgent, RoomLlmProvider, RoomBusinessRule (Scenario "Studio de IA por Mesa")

-- CreateTable
CREATE TABLE "RoomAiAgent" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Agente IA',
    "avatar" TEXT NOT NULL DEFAULT '🤖',
    "systemPrompt" TEXT NOT NULL DEFAULT 'You are an expert planning-poker contributor analyzing user stories, voting realistically against the deck, and explaining estimates.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomAiAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomLlmProvider" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomLlmProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomBusinessRule" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomBusinessRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomAiAgent_roomId_key" ON "RoomAiAgent"("roomId");

-- CreateIndex
CREATE INDEX "RoomLlmProvider_roomId_idx" ON "RoomLlmProvider"("roomId");

-- CreateIndex
CREATE INDEX "RoomBusinessRule_roomId_order_idx" ON "RoomBusinessRule"("roomId", "order");

-- AddForeignKey
ALTER TABLE "RoomAiAgent" ADD CONSTRAINT "RoomAiAgent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomLlmProvider" ADD CONSTRAINT "RoomLlmProvider_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBusinessRule" ADD CONSTRAINT "RoomBusinessRule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;