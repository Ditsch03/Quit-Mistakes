-- Datenbankstruktur basierend auf deinem RM
CREATE TABLE IF NOT EXISTS Users (
    UserID INTEGER PRIMARY KEY AUTOINCREMENT,
    Username TEXT NOT NULL UNIQUE,
    Email TEXT NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Races (
    RaceID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER,
    RaceName TEXT NOT NULL,
    RaceDate DATE,
    MapName TEXT,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);

CREATE TABLE IF NOT EXISTS ErrorEntries (
    ErrorID INTEGER PRIMARY KEY AUTOINCREMENT,
    RaceID INTEGER,
    LegNumber INTEGER,
    TimeLoss INTEGER,
    ErrorType TEXT, -- z.B. Technisch, Physisch, Mental
    Description TEXT,
    FOREIGN KEY (RaceID) REFERENCES Races(RaceID)
);

CREATE TABLE IF NOT EXISTS Friends (
    FriendshipID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserOneID INTEGER, -- Der Anfragende
    UserTwoID INTEGER, -- Der Empfänger
    Status TEXT DEFAULT 'pending', -- 'pending' oder 'accepted'
    FOREIGN KEY (UserOneID) REFERENCES Users(UserID),
    FOREIGN KEY (UserTwoID) REFERENCES Users(UserID)
);

