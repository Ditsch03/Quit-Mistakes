const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite'); // Pfad zu deiner DB

db.serialize(() => {
    // Löscht alle Daten aus den Tabellen
    db.run("DELETE FROM errorEntries");
    db.run("DELETE FROM races");
    db.run("DELETE FROM users");
    console.log("✅ Datenbank erfolgreich geleert.");
});
db.close();