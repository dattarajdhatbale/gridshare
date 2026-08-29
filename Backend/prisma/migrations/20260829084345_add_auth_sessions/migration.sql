-- CreateTable
CREATE TABLE "Session" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "meterId" TEXT,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pv" REAL NOT NULL,
    "baseLoad" REAL NOT NULL,
    "distance" REAL NOT NULL,
    "earned" REAL NOT NULL DEFAULT 0.0,
    "sharedPartners" TEXT NOT NULL DEFAULT '',
    "pin" TEXT NOT NULL DEFAULT '0000',
    "displayName" TEXT
);
INSERT INTO "new_Meter" ("baseLoad", "distance", "earned", "id", "name", "pv", "role", "sharedPartners") SELECT "baseLoad", "distance", "earned", "id", "name", "pv", "role", "sharedPartners" FROM "Meter";
DROP TABLE "Meter";
ALTER TABLE "new_Meter" RENAME TO "Meter";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
