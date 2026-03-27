const API_URL = 'https://quitmistakes-backend.onrender.com';
let viewedUserId = null;
let viewedUserName = "";
let currentRaceId = null;


// Prüfen, ob der User bereits eingeloggt war, wenn die Seite lädt
window.onload = () => {
    const savedUserId = localStorage.getItem('userId');
    const savedUsername = localStorage.getItem('username');

    if (savedUserId && savedUsername) {
        // Falls Daten da sind, direkt ins Dashboard springen
        showDashboard(savedUsername);
    }
};

// Wechselt die Ansicht zwischen Login und Registrierung
function toggleAuth() {
    const loginBox = document.getElementById('login-box');
    const registerBox = document.getElementById('register-box');

    if (loginBox.style.display === 'none') {
        loginBox.style.display = 'block';
        registerBox.style.display = 'none';
    } else {
        loginBox.style.display = 'none';
        registerBox.style.display = 'block';
    }
}

// REGISTRIERUNG
async function register() {
    const username = document.getElementById('reg-user').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if (!username || !email || !password) {
        return alert("Bitte alle Felder ausfüllen!");
    }

    const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();

    if (response.ok) {
        alert("Registrierung erfolgreich! Du kannst dich jetzt einloggen.");
        toggleAuth(); // Zurück zum Login
    } else {
        alert("Fehler: " + data.error);
    }
}

// LOGIN
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
        // Erfolg: Wir speichern die User-Info im Browser-Speicher (Session)
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('username', data.user.username);

        showDashboard(data.user.username);
    } else {
        alert("Login fehlgeschlagen: " + data.error);
    }

}

// Zeigt das Dashboard nach dem Login
async function showDashboard(username) {
    // 1. UI Umschalten
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('welcome-msg').innerText = `Hallo, ${username}!`;

    setTimeout(() => {
        renderCalendar();
    }, 10);
}

// LOGOUT
function logout() {
    localStorage.clear();
    location.reload(); // Seite neu laden führt zurück zum Login
}

// Funktion: Neuen Wettkampf speichern
async function createRace() {
    const userId = localStorage.getItem('userId');
    const raceName = document.getElementById('race-name').value;
    const raceDate = document.getElementById('race-date').value;
    const mapName = document.getElementById('race-map').value;

    if (!raceName) return alert("Bitte mindestens einen Namen für den Lauf eingeben!");

    const response = await fetch(`${API_URL}/races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, raceName, raceDate, mapName })
    });

    if (response.ok) {
        alert("Wettkampf gespeichert!");
        // Felder leeren
        document.getElementById('race-name').value = '';
        document.getElementById('race-date').value = '';
        document.getElementById('race-map').value = '';
        // Liste aktualisieren
        loadRaces();
    } else {
        alert("Fehler beim Speichern des Wettkampfs.");
    }
}

// Funktion: Alle Wettkämpfe des Users laden und anzeigen
async function loadRaces() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const response = await fetch(`${API_URL}/races/${userId}`);
    const races = await response.json();

    const listElement = document.getElementById('race-list');
    listElement.innerHTML = ''; // Liste leeren

    races.forEach(race => {
        const li = document.createElement('li');
        li.className = 'card';
        li.style.marginBottom = '10px';
        li.innerHTML = `
            <strong>${race.RaceName}</strong> (${race.RaceDate || 'Kein Datum'}) <br>
            <small>Karte: ${race.MapName || 'Unbekannt'}</small> <br>
            <button onclick="selectRace(${race.RaceID}, '${race.RaceName}')" style="margin-top:10px; background:#007bff;">Fehler erfassen</button>
        `;
        listElement.appendChild(li);
    });
}

// Diese Funktion rufen wir auf, wenn der User eingeloggt ist
// Passe deine vorhandene showDashboard Funktion an:
function showDashboard(username) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('welcome-msg').innerText = `Hallo, ${username}!`;
    loadRaces(); // <--- Neu: Lädt die Wettkämpfe direkt beim Login
}


async function selectRace(raceId, raceName, raceMap) {
    // 1. IDs klären
    const myId = parseInt(localStorage.getItem('userId'));
    const isReadOnly = (viewedUserId !== myId);

    // 2. Namen und View setzen
    document.getElementById('selected-race-name').innerText = raceName;
    document.getElementById('selected-race-map').innerText = raceMap;

    // Die aktuelle RaceID global speichern (für saveError)
    window.currentRaceId = raceId;

    // 3. SCHREIBSCHUTZ LOGIK
    const errorForm = document.getElementById('new-error-form');
    if (errorForm) {
        if (isReadOnly) {
            // Trainer-Modus: Formular zum Erstellen komplett verstecken
            errorForm.style.display = 'none';
        } else {
            // Besitzer-Modus: Formular anzeigen
            errorForm.style.display = 'block';
        }
    }

    // 4. View wechseln
    document.getElementById('calendar-view').style.display = 'none';
    document.getElementById('error-detail-view').style.display = 'block';

    // 5. Vorhandene Fehler für dieses Rennen laden
    loadErrors(raceId);
}

function backToDashboard() {
    // 1. Die Detail-Ansicht verstecken
    document.getElementById('error-detail-view').style.display = 'none';

    // 2. Das Haupt-Dashboard sicherstellen
    document.getElementById('dashboard').style.display = 'block';

    // 3. Sicherstellen, dass wir im Dashboard die KALENDER-Ansicht sehen
    // (und nicht etwa noch die Freunde- oder Analyse-Ansicht)
    showView('calendar-view');

    // 4. Den Kalender neu zeichnen
    // Da viewedUserId global gespeichert bleibt, zeichnet renderCalendar()
    // automatisch den Kalender der Person, die du gerade anschaust.
    renderCalendar();
}

async function saveError() {
    const myId = parseInt(localStorage.getItem('userId'));

    // Debug-Log: Was ist gerade Sache?
    console.log("Speichere Fehler für Race:", currentRaceId, "User:", myId, "Viewed:", viewedUserId);

    if (!currentRaceId) {
        alert("Kein Rennen ausgewählt!");
        return;
    }

    if (viewedUserId && viewedUserId !== myId) {
        alert("Du hast keine Berechtigung, Fehler für diesen User zu speichern.");
        return;
    }

    // Werte auslesen
    const legNumber = document.getElementById('err-leg').value;
    const timeLoss = document.getElementById('err-time').value;
    const errorType = document.getElementById('err-type').value;
    const description = document.getElementById('err-desc').value;

    // Pflichtfelder-Check (verhindert leere Datenbank-Einträge)
    if (!legNumber || !timeLoss) {
        alert("Bitte Posten-Nummer und Zeitverlust angeben.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/errors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                raceId: currentRaceId,
                legNumber: parseInt(legNumber),
                timeLoss: parseFloat(timeLoss),
                errorType,
                description
            })
        });

        if (response.ok) {
            console.log("Fehler erfolgreich gespeichert");
            loadErrors(currentRaceId);
            // Felder zurücksetzen
            document.getElementById('err-leg').value = '';
            document.getElementById('err-time').value = '';
            document.getElementById('err-desc').value = '';
        } else {
            const errData = await response.json();
            alert("Fehler vom Server: " + errData.error);
        }
    } catch (error) {
        console.error("Netzwerkfehler:", error);
        alert("Verbindung zum Server fehlgeschlagen.");
    }
}

async function loadErrors(raceId) {
    const response = await fetch(`${API_URL}/errors/${raceId}`);
    const errors = await response.json();
    const tableBody = document.getElementById('error-list-body');
    tableBody.innerHTML = '';

    errors.forEach(err => {
        const row = `<tr>
            <td>${err.LegNumber}</td>
            <td>${err.TimeLoss}s</td>
            <td>${err.ErrorType}</td>
            <td><small>${err.Description || ''}</small></td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

async function loadStatistics() {
    const userId = localStorage.getItem('userId');
    const response = await fetch(`${API_URL}/stats/${userId}`);
    const stats = await response.json();

    const statsContent = document.getElementById('stats-content');
    if (stats.length === 0) {
        statsContent.innerHTML = "<p>Noch keine Fehlerdaten für Statistiken vorhanden.</p>";
        return;
    }

    let html = "<ul>";
    stats.forEach(s => {
        html += `<li><strong>${s.ErrorType}:</strong> ${s.Count} Fehler (${s.TotalTimeLoss}s Verlust)</li>`;
    });
    html += "</ul>";
    statsContent.innerHTML = html;
}

// Erweitere die showDashboard Funktion erneut, um die Stats zu laden:
function showDashboard(username) {
    // 1. Login-Maske weg, Dashboard her
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // 2. Willkommens-Text setzen
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) welcomeMsg.innerText = `Hallo, ${username}!`;

    // 3. Den Kalender über die zentrale Steuerung laden
    showView('calendar-view');
}

let currentViewDate = new Date(); // Das Datum, das der Kalender gerade anzeigt
let selectedDateStr = ""; // Das Datum, das man anklickt

// Schaltet zwischen Kalender und Analyse um
function showView(viewId) {
    // Alle Ansichten verstecken
    const views = document.querySelectorAll('.view');
    views.forEach(v => v.style.display = 'none');

    // Die gewünschte Ansicht zeigen
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = 'block';
    }

    // Daten laden je nach Ansicht
    if (viewId === 'calendar-view') {
        renderCalendar();
    } else if (viewId === 'analysis-view') {
        loadStatistics();
    }
    if (viewId === 'friends-view') loadFriendsData();
}

function changeMonth(offset) {
    currentViewDate.setMonth(currentViewDate.getMonth() + offset);
    renderCalendar();
}

function updateCalendarHeader(isMyProfile) {
    const ownerTitle = document.getElementById('calendar-owner-title');
    if (!ownerTitle) return;

    if (isMyProfile) {
        ownerTitle.innerText = "Dein Tagebuch";
        ownerTitle.style.color = "#2c3e50";
    } else {
        // Wir nehmen den Namen direkt aus der globalen Variable
        const name = viewedUserName || "Athlet";

        const lastChar = name.slice(-1).toLowerCase();
        const sSounds = ['s', 'ß', 'x', 'z'];
        const displayName = sSounds.includes(lastChar) ? `${name}' Tagebuch` : `${name}s Tagebuch`;

        ownerTitle.innerText = displayName;
        ownerTitle.style.color = "#3498db";
    }
}

async function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthDisplay = document.getElementById('current-month-display');

    if (!grid || !monthDisplay) return;

    grid.innerHTML = '';


    // 1. Identität klären
    const myId = parseInt(localStorage.getItem('userId'));
    if (!viewedUserId) viewedUserId = myId;
    const isMyProfile = (viewedUserId === myId);

    // 2. Den neuen Header-Text setzen (ausgelagerte Funktion)
    updateCalendarHeader(isMyProfile);

    // 3. Monat/Jahr anzeigen
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    monthDisplay.innerText = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(currentViewDate);

    // 4. Daten laden
    const response = await fetch(`${API_URL}/races/${viewedUserId}`);
    const races = await response.json();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay === 0 ? 6 : firstDay - 1);

    // Leere Tage am Anfang
    for (let i = 0; i < startOffset; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day empty';
        grid.appendChild(emptyDiv);
    }

    // 5. Tage zeichnen
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const racesThisDay = races.filter(r => r.RaceDate === dateStr);

        // Tag erstellen
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `<strong>${day}</strong>`;

        // Rennen einfügen
        racesThisDay.forEach(race => {
            const raceLink = document.createElement('div');
            raceLink.className = 'calendar-race-link';
            raceLink.innerText = race.RaceName;
            raceLink.onclick = (e) => {
                e.stopPropagation();
                selectRace(race.RaceID, race.RaceName, race.MapName);
            };
            dayEl.appendChild(raceLink);
        });

        // Schreibschutz-Check
        if (isMyProfile) {
            dayEl.onclick = () => openRaceModal(dateStr);
            dayEl.style.cursor = "pointer";
        } else {
            dayEl.onclick = null;
            dayEl.style.cursor = "default";
            dayEl.classList.add('readonly');
        }

        grid.appendChild(dayEl);
    }
}

// Modal-Steuerung
function openRaceModal(date) {
    selectedDateStr = date;
    document.getElementById('selected-date-display').innerText = date;
    document.getElementById('race-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('race-modal').style.display = 'none';
}

// Speichern & Direkt-Weiterleitung
async function saveRaceFromCalendar() {
    const userId = localStorage.getItem('userId');
    const raceName = document.getElementById('race-name').value;
    const raceMap = document.getElementById('race-map').value;

    const response = await fetch(`${API_URL}/races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, raceName, raceDate: selectedDateStr, mapName: raceMap })
    });

    if (response.ok) {
        const data = await response.json();
        closeModal();
        // Sofort zur Fehlererfassung dieses neuen Rennens springen!
        selectRace(data.raceId, raceName);
    }
}



function viewMyProfile() {
    const myId = parseInt(localStorage.getItem('userId'));
    viewedUserId = myId;
    viewedUserName = localStorage.getItem('username');

    // 1. Erst die Ansicht umschalten
    showView('calendar-view');

    // 2. Dann rendern
    renderCalendar();
}

function viewFriendProfile(friendId, friendName) {
    viewedUserId = parseInt(friendId);
    viewedUserName = friendName;

    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) welcomeMsg.innerText = `Profil von: ${friendName}`;

    // 1. Erst die Ansicht umschalten
    showView('calendar-view');

    // 2. Dann rendern
    renderCalendar();
}

async function searchUsers() {
    const query = document.getElementById('user-search-input').value;
    if (!query) return;

    const response = await fetch(`${API_URL}/users/search/${query}`);
    const users = await response.json();
    const resultsDiv = document.getElementById('search-results');

    const myId = parseInt(localStorage.getItem('userId'));

    resultsDiv.innerHTML = users.map(u => {
        // Mich selbst kann ich nicht anfragen
        if (u.UserID === myId) return `<p><em>${u.Username} (Du)</em></p>`;

        return `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span>${u.Username}</span>
                <button onclick="sendFriendRequest(${u.UserID})" style="width: auto; padding: 5px 10px;">Anfragen</button>
            </div>
        `;
    }).join('');
}

async function loadFriendsData() {
    const myId = parseInt(localStorage.getItem('userId'));

    try {
        // 1. Alle User über den neuen, sicheren Endpunkt laden
        const userRes = await fetch(`${API_URL}/users/all`);
        if (!userRes.ok) throw new Error("Fehler beim Laden der Userliste");

        const allUsers = await userRes.json();
        const userMap = {};
        allUsers.forEach(u => userMap[u.UserID] = u.Username);

        // 2. Freundschaften laden
        const response = await fetch(`${API_URL}/friends/${myId}`);
        const relations = await response.json();

        const friendsList = document.getElementById('friends-list');
        friendsList.innerHTML = "";

        if (relations.length === 0) {
            friendsList.innerHTML = "<p style='color:gray;'>Keine Anfragen oder Kontakte gefunden.</p>";
            return;
        }

        relations.forEach(rel => {
            const isSender = parseInt(rel.UserOneID) === myId;
            const friendId = isSender ? rel.UserTwoID : rel.UserOneID;
            const friendName = userMap[friendId] || `User #${friendId}`;

            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginBottom = "10px";
            card.style.padding = "15px";

            if (rel.Status === 'pending') {
                if (isSender) {
                    card.innerHTML = `<p style="color:gray; margin:0;">Wartend: Anfrage an <b>${friendName}</b> gesendet.</p>`;
                } else {
                    card.innerHTML = `
                        <p style="margin-bottom:10px;">Anfrage von <b>${friendName}</b></p>
                        <div style="display:flex; gap:10px;">
                            <button onclick="acceptFriend(${rel.FriendshipID})" style="background:#2ecc71; flex:1;">Annehmen</button>
                            <button onclick="rejectFriend(${rel.FriendshipID})" style="background:#e74c3c; flex:1;">Ablehnen</button>
                        </div>
                    `;
                }
            } else if (rel.Status === 'accepted') {
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span><b>${friendName}</b></span>
                        <button onclick="viewFriendProfile(${friendId}, '${friendName}')" style="width:auto; padding:5px 15px; background:#3498db;">Profil ansehen</button>
                    </div>
                `;
            }
            friendsList.appendChild(card);
        });
    } catch (err) {
        console.error("Kritischer Fehler in loadFriendsData:", err);
    }
}

// Funktion zum Senden (falls noch nicht fertig)
async function sendFriendRequest(receiverId) {
    const senderId = parseInt(localStorage.getItem('userId'));
    const response = await fetch(`${API_URL}/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, receiverId: parseInt(receiverId) })
    });

    if (response.ok) {
        // Statt alert("Erfolg") und manuellem Refresh:
        // Wir laden die Liste einfach sofort neu!
        await loadFriendsData();
        document.getElementById('user-search-input').value = ""; // Suchfeld leeren
        document.getElementById('search-results').innerHTML = ""; // Ergebnisse leeren
    }
}

// Funktion zum Annehmen
async function acceptFriend(friendshipId) {
    console.log("Annehmen der ID:", friendshipId); // Debug-Check in der Browser-Konsole

    const response = await fetch(`${API_URL}/friends/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: parseInt(friendshipId) }) // Sicherstellen, dass es eine Zahl ist
    });

    if (response.ok) {
        loadFriendsData();
    } else {
        const errData = await response.json();
        alert("Fehler beim Annehmen: " + errData.error);
    }
}

async function rejectFriend(friendshipId) {
    if (!confirm("Möchtest du diese Anfrage wirklich löschen?")) return;

    const response = await fetch(`${API_URL}/friends/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: parseInt(friendshipId) })
    });

    if (response.ok) {
        loadFriendsData();
    }
}