-- CreateTable
CREATE TABLE "SimulationState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "tick" INTEGER NOT NULL DEFAULT 62,
    "playing" BOOLEAN NOT NULL DEFAULT true,
    "speed" TEXT NOT NULL DEFAULT '1x',
    "cumulativeBaseline" REAL NOT NULL DEFAULT 0.0
);

-- CreateTable
CREATE TABLE "Meter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pv" REAL NOT NULL,
    "baseLoad" REAL NOT NULL,
    "distance" REAL NOT NULL,
    "earned" REAL NOT NULL DEFAULT 0.0,
    "sharedPartners" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tick" INTEGER NOT NULL,
    "meterId" TEXT NOT NULL,
    "generation" REAL NOT NULL,
    "load" REAL NOT NULL,
    "exportKWh" REAL NOT NULL,
    "importKWh" REAL NOT NULL,
    "voltage" REAL NOT NULL,
    "current" REAL NOT NULL,
    "powerFactor" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tick" INTEGER NOT NULL,
    "buyer" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "sent" REAL NOT NULL,
    "delivered" REAL NOT NULL,
    "lossKWh" REAL NOT NULL,
    "distance" REAL NOT NULL,
    "lossFrac" REAL NOT NULL,
    "nCharge" REAL NOT NULL,
    "energyPrice" REAL NOT NULL,
    "buyerUnitPrice" REAL NOT NULL,
    "buyerPayment" REAL NOT NULL,
    "sellerRevenue" REAL NOT NULL,
    "networkRevenue" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "MeterReading_tick_idx" ON "MeterReading"("tick");

-- CreateIndex
CREATE INDEX "MeterReading_meterId_idx" ON "MeterReading"("meterId");

-- CreateIndex
CREATE INDEX "Trade_tick_idx" ON "Trade"("tick");
