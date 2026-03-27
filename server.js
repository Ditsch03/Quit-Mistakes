const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Datenbank Verbindung & Initialisierung
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) return console.error(err.message);
    console.log('Verbunden mit der SQLite-Datenbank.');
    
    // Schema beim Start einmalig einlesen, falls Tabellen fehlen
    const schema = fs.readFileSync('./schema.sql').toString();
    db.exec(schema, (err) => {
        if (err) console.error("Fehler beim Erstellen der Tabellen:", err.message);
    });
});

// Test-Route
app.get('/', (req, res) => {
    res.send('Der OL-Analyse Server läuft!');
});
// Endpunkt für die Registrierung
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // 1. Passwort verschlüsseln (Salt-Rounds: 10)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 2. Benutzer in die Datenbank schreiben
        const sql = `INSERT INTO Users (Username, Email, PasswordHash) VALUES (?, ?, ?)`;
        
        db.run(sql, [username, email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: "Benutzername oder E-Mail bereits vergeben." });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: "Benutzer erfolgreich registriert!", userId: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: "Serverfehler bei der Verschlüsselung." });
    }
});
// Endpunkt für den Login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // 1. Benutzer anhand der E-Mail suchen
    const sql = `SELECT * FROM Users WHERE Email = ?`;
    
    db.get(sql, [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(401).json({ error: "Ungültige E-Mail oder Passwort." });
        }

        // 2. Passwort vergleichen
        const match = await bcrypt.compare(password, user.PasswordHash);
        
        if (match) {
            // Login erfolgreich
            // Wir schicken die UserID und den Namen zurück, damit das Frontend weiß, wer eingeloggt ist
            res.json({
                message: "Login erfolgreich!",
                user: {
                    id: user.UserID,
                    username: user.Username
                }
            });
        } else {
            res.status(401).json({ error: "Ungültige E-Mail oder Passwort." });
        }
    });
});

// Endpunkt: Neuen Wettkampf erstellen
app.post('/races', (req, res) => {
    const { userId, raceName, raceDate, mapName } = req.body;

    if (!userId || !raceName) {
        return res.status(400).json({ error: "UserID und Name des Laufs fehlen." });
    }

    const sql = `INSERT INTO Races (UserID, RaceName, RaceDate, MapName) VALUES (?, ?, ?, ?)`;

    db.run(sql, [userId, raceName, raceDate, mapName], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            message: "Wettkampf erfolgreich erstellt!",
            raceId: this.lastID
        });
    });
});

// Endpunkt: Alle Wettkämpfe eines Benutzers abrufen
app.get('/races/:userId', (req, res) => {
    const userId = req.params.userId;
    const sql = `SELECT * FROM Races WHERE UserID = ? ORDER BY RaceDate DESC`;

    db.all(sql, [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});
// Endpunkt: Neuen Fehler für einen Wettkampf speichern
app.post('/errors', (req, res) => {
    const { raceId, legNumber, timeLoss, errorType, description } = req.body;

    const sql = `INSERT INTO ErrorEntries (RaceID, LegNumber, TimeLoss, ErrorType, Description) 
                 VALUES (?, ?, ?, ?, ?)`;

    db.run(sql, [raceId, legNumber, timeLoss, errorType, description], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Fehler erfolgreich erfasst!", errorId: this.lastID });
    });
});

// Endpunkt: Alle Fehler eines Wettkampfs abrufen
app.get('/errors/:raceId', (req, res) => {
    const raceId = req.params.raceId;
    const sql = `SELECT * FROM ErrorEntries WHERE RaceID = ? ORDER BY LegNumber ASC`;

    db.all(sql, [raceId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Endpunkt: Statistiken für einen User abrufen (über alle seine Rennen)
app.get('/stats/:userId', (req, res) => {
    const userId = req.params.userId;
    const sql = `
        SELECT 
            ErrorType, 
            COUNT(*) as Count, 
            SUM(TimeLoss) as TotalTimeLoss 
        FROM ErrorEntries 
        JOIN Races ON ErrorEntries.RaceID = Races.RaceID
        WHERE Races.UserID = ?
        GROUP BY ErrorType`;

    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Benutzer suchen (nach Username)
app.get('/users/search/:query', (req, res) => {
    const query = `%${req.params.query}%`;
    db.all("SELECT UserID, Username FROM Users WHERE Username LIKE ? LIMIT 10", [query], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// Freundschaftsanfrage senden
app.post('/friends/request', (req, res) => {
    const { senderId, receiverId } = req.body;

    console.log(`ANFRAGE-LOG: User ${senderId} möchte User ${receiverId} hinzufügen.`);

    if (!senderId || !receiverId) {
        return res.status(400).json({ error: "Sender oder Empfänger fehlt." });
    }

    const sql = `INSERT INTO Friends (UserOneID, UserTwoID, Status) VALUES (?, ?, 'pending')`;

    db.run(sql, [senderId, receiverId], function(err) {
        if (err) {
            console.error("Datenbankfehler beim Speichern:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Erfolg: Anfrage gespeichert unter ID ${this.lastID}`);
        res.status(201).json({ message: "Anfrage gesendet", friendshipId: this.lastID });
    });
});

// Freundschaften/Anfragen abrufen
app.get('/friends/:userId', (req, res) => {
    const userId = req.params.userId;
    console.log("Anfrage für User-ID:", userId);

    // Wir holen einfach JEDEN Eintrag, wo der User vorkommt. Keine Joins!
    const sql = `SELECT * FROM Friends WHERE UserOneID = ? OR UserTwoID = ?`;

    db.all(sql, [userId, userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        console.log("Rohdaten aus DB:", rows);
        res.json(rows);
    });
});

// Neuen Endpunkt für ALLE User hinzufügen
app.get('/users/all', (req, res) => {
    db.all("SELECT UserID, Username FROM Users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Freundschaftsanfrage annehmen
app.post('/friends/accept', (req, res) => {
    const { friendshipId } = req.body;

    if (!friendshipId) return res.status(400).json({ error: "Keine ID übermittelt" });

    db.run("UPDATE Friends SET Status = 'accepted' WHERE FriendshipID = ?", [friendshipId], function(err) {
        if (err) {
            console.error("SQL Fehler beim Annehmen:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Anfrage angenommen!" });
    });
});

// Freundschaftsanfrage ABLEHNEN (Löscht den Eintrag einfach)
app.post('/friends/reject', (req, res) => {
    const { friendshipId } = req.body;

    db.run("DELETE FROM Friends WHERE FriendshipID = ?", [friendshipId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Anfrage entfernt" });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server läuft auf Port ${PORT}`);
});


