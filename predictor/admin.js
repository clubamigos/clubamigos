const database = firebase.database();

let knockoutLocked = false;

const GROUPS = {
  A: ["Mexico", "South Africa", "South Korea", "Czech Republic"],
  B: ["Canada", "Bosnia & Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Turkey"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"]
};

/* ================= SECTION SWITCHING ================= */

function showSection(sectionId) {

  document.querySelectorAll(".admin-section").forEach(sec => {
    sec.classList.add("hidden");
  });

  document.getElementById(sectionId).classList.remove("hidden");

  // 🔥 LOAD BRACKET WHEN OPENED
  if (sectionId === "bracketSection") {
    loadBracketAdmin();
  }
  if (sectionId === "matchSection") {
    loadMatches();
  }

}

/* ================= CREATE USER ================= */

function createUser() {

  const username = document.getElementById("newUsername").value.trim();
  const phone = document.getElementById("newPhone").value.trim();
  const password = document.getElementById("newPassword").value.trim();

  if (!username || !phone || !password) {
    alert("Fill all fields");
    return;
  }

  database.ref("users")
    .orderByChild("phone")
    .equalTo(phone)
    .once("value")
    .then((snapshot) => {

      if (snapshot.exists()) {
        alert("Phone number already exists!");
        return;
      }

      const uid = "u_" + Date.now();

      database.ref("users/" + uid).set({
        uid: uid,
        username: username,
        phone: phone,
        password: password,
        mustChangePassword: true,   // ✅ ADD THIS
        createdAt: Date.now(),
        points: {
          match: 0,
          bracket: 0,
          total: 0
        }
      }).then(() => {

        alert("User created successfully");

        document.getElementById("newUsername").value = "";
        document.getElementById("newPhone").value = "";
        document.getElementById("newPassword").value = "";

      });

    });
}

/* ================= LOAD USERS ================= */

function loadUsers() {

  database.ref("users").on("value", (snapshot) => {

    const container = document.getElementById("usersList");
    container.innerHTML = "";

    if (!snapshot.exists()) {
      container.innerHTML = "<p>No users found.</p>";
      return;
    }

    snapshot.forEach((child) => {

      const uid = child.key;
      const user = child.val();

      const matchPoints = user.points?.match || 0;
      const bracketPoints = user.points?.bracket || 0;
      const totalPoints = user.points?.total || 0;

      const userCard = document.createElement("div");
      userCard.className = "user-card";

      userCard.innerHTML = `
        <div>
          <strong>${user.username}</strong><br>
          Phone: ${user.phone}<br>
          Password: ${user.password}<br><br>
          <b>Match Points:</b> ${matchPoints}<br>
          <b>Bracket Points:</b> ${bracketPoints}<br>
          <b>Total Points:</b> ${totalPoints}
        </div>

        <button class="primary-btn" onclick="resetUserPassword('${uid}')">
  Reset Password
</button>

<button class="secondary-btn" onclick="deleteUser('${uid}')">
  Delete
</button>
      `;

      container.appendChild(userCard);
    });
  });
}

/* ================= DELETE USER ================= */

function deleteUser(uid) {
  if (confirm("Delete this user?")) {
    database.ref("users/" + uid).remove();
  }
}

/* ================= LOGOUT ================= */

function logoutAdmin() {
  sessionStorage.removeItem("isAdmin");
  window.location.href = "index.html";
}

/* ================= INIT USERS ================= */

loadUsers();

/* ================= CREATE MATCH ================= */

function createMatch() {

  const matchNo = document.getElementById("matchNo").value.trim();
  const matchDate = document.getElementById("matchDate").value;
  const matchGroup = document.getElementById("matchGroup").value.trim();
  const teamA = document.getElementById("teamA").value.trim();
  const teamB = document.getElementById("teamB").value.trim();

  if (!matchNo || !matchDate || !matchGroup || !teamA || !teamB) {
    alert("Fill all match fields");
    return;
  }

  const matchId = "m_" + Date.now();

  database.ref("matches/" + matchId).set({
    matchId: matchId,
    matchNo: matchNo,
    date: matchDate,
    group: matchGroup,
    teamA: teamA,
    teamB: teamB,
    locked: false,
    createdAt: Date.now()
  }).then(() => {

    alert("Match created successfully");

    document.getElementById("matchNo").value = "";
    document.getElementById("matchDate").value = "";
    document.getElementById("matchGroup").value = "";
    document.getElementById("teamA").value = "";
    document.getElementById("teamB").value = "";
  });
}

/* ================= LOAD MATCHES ================= */

function loadMatches() {

  database.ref("matches").on("value", (snapshot) => {

    const container = document.getElementById("matchesList");
    container.innerHTML = "";

    if (!snapshot.exists()) {
      container.innerHTML = "<p>No matches created.</p>";
      return;
    }

    snapshot.forEach((child) => {

      const match = child.val();
      const matchId = child.key;

      const statusText = match.locked ? "🔴 Locked" : "🟢 Open";
      const buttonText = match.locked ? "Unlock" : "Lock";

      const matchCard = document.createElement("div");
      matchCard.className = "match-card";

      matchCard.innerHTML = `
        <div>
          <strong>Match ${match.matchNo}</strong><br>
          ${match.teamA} vs ${match.teamB}<br>
          Date: ${match.date}<br>
          Group: ${match.group}<br><br>
          <b>Status:</b> ${statusText}
        </div>

        <div style="margin-top:15px;">
          <input type="number" id="actualA_${matchId}" placeholder="Score A" min="0" style="width:70px;">
          <span> - </span>
          <input type="number" id="actualB_${matchId}" placeholder="Score B" min="0" style="width:70px;">
          <button class="primary-btn"
            onclick="submitResult('${matchId}')">
            Submit Result
          </button>
        </div>

        <div style="margin-top:10px;">
          <button class="secondary-btn"
            onclick="toggleMatchLock('${matchId}', ${match.locked})">
            ${buttonText}
          </button>
        </div>
      `;

      container.appendChild(matchCard);
    });
  });
}

/* ================= TOGGLE LOCK ================= */

function toggleMatchLock(matchId, currentStatus) {
  database.ref("matches/" + matchId).update({
    locked: !currentStatus
  });
}

/* ================= SCORING SYSTEM ================= */

function calculatePoints(userA, userB, actualA, actualB) {

  if (userA === actualA && userB === actualB) {
    return 5;
  }

  if (
    (userA === actualA && userB !== actualB) ||
    (userA !== actualA && userB === actualB)
  ) {
    return 2;
  }

  return 0;
}

function submitResult(matchId) {

  const scoreA = document.getElementById("actualA_" + matchId).value;
  const scoreB = document.getElementById("actualB_" + matchId).value;

  if (scoreA === "" || scoreB === "") {
    alert("Enter both actual scores");
    return;
  }

  const actualA = parseInt(scoreA);
  const actualB = parseInt(scoreB);

  database.ref("matches/" + matchId).update({
    scoreA: actualA,
    scoreB: actualB,
    finished: true
  }).then(() => {

    processMatchPoints(matchId, actualA, actualB);

  });
}

function processMatchPoints(matchId, actualA, actualB) {

  database.ref("predictions/" + matchId).once("value")
    .then(snapshot => {

      if (!snapshot.exists()) {
        alert("No predictions found for this match.");
        return;
      }

      snapshot.forEach(child => {

        const userId = child.key;
        const prediction = child.val();

        const userA = prediction.scoreA;
        const userB = prediction.scoreB;

        const earnedPoints = calculatePoints(userA, userB, actualA, actualB);

        saveUserMatchPoints(userId, matchId, earnedPoints);
      });

      alert("Match result processed and points updated!");
    });
}

function saveUserMatchPoints(userId, matchId, earnedPoints) {

  const userRef = database.ref("users/" + userId);

  userRef.once("value").then(snapshot => {

    // 🔒 If user does not exist, skip
    if (!snapshot.exists()) {
      console.log("User not found, skipping:", userId);
      return;
    }

    // Overwrite matchPoints safely
    database.ref("users/" + userId + "/matchPoints/" + matchId)
      .set(earnedPoints)
      .then(() => {
        recalculateUserTotals(userId);
      });

  });

}

function recalculateUserTotals(userId) {

  database.ref("users/" + userId).once("value")
    .then(snapshot => {

      const user = snapshot.val();
      const matchPointsObj = user.matchPoints || {};
      const bracketPoints = user.points?.bracket || 0;

      let totalMatchPoints = 0;

      for (let key in matchPointsObj) {
        totalMatchPoints += matchPointsObj[key];
      }

      const newTotal = totalMatchPoints + bracketPoints;

      database.ref("users/" + userId + "/points").update({
        match: totalMatchPoints,
        total: newTotal
      });
    });
}

/* ================= BRACKET LOCK MANAGEMENT ================= */

function listenBracketLockStatus() {

  database.ref("bracketResults/lock/bracket")
    .on("value", snapshot => {

      const val = snapshot.val();
      const isLocked = val === true;

      const statusText = document.getElementById("bracketLockStatus");
      const btn = document.getElementById("toggleBracketLockBtn");

      if (!statusText || !btn) return;

      if (isLocked) {
        statusText.innerText = "🔴 Locked";
        btn.innerText = "Unlock Bracket";
      } else {
        statusText.innerText = "🟢 Open";
        btn.innerText = "Lock Bracket";
      }
    });
}

function toggleBracketLock() {

  database.ref("bracketResults/lock/bracket")
    .once("value")
    .then(snapshot => {

      const current = snapshot.val() === true;

      database.ref("bracketResults/lock")
        .update({
          bracket: !current
        });

    });
}

function loadBracketAdmin() {

  const container = document.getElementById("bracketAdminContainer");

  let html = "";

  // ================= GROUP STAGE =================
  Object.keys(GROUPS).forEach(group => {

    html += `
      <div class="admin-box">
        <h3>Group ${group}</h3>

        <label>1st Place</label>
        <select id="admin_${group}_1">
          <option value="">Select</option>
          ${GROUPS[group].map(team => `<option value="${team}">${team}</option>`).join("")}
        </select>

        <br><br>

        <label>2nd Place</label>
        <select id="admin_${group}_2">
          <option value="">Select</option>
          ${GROUPS[group].map(team => `<option value="${team}">${team}</option>`).join("")}
        </select>

        <br><br>

        <button onclick="submitSingleGroup('${group}')">
          Submit Group ${group}
        </button>

        <button onclick="toggleGroupLock('${group}')">
          Lock Group ${group}
        </button>

        <p id="status_${group}"></p>
      </div>
    `;
  });

  // ================= BEST 3RD =================
  html += `
  <div class="admin-box" style="margin-top:30px;">
    <h3>Best 3rd Teams (Select 8)</h3>

    <div id="adminBestThirdContainer"
      style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px;">
    </div>

    <p id="adminThirdCount">Selected: 0 / 8</p>

    <button class="primary-btn" onclick="submitBestThirdActual()">
      Submit Best 3rd Result
    </button>

    <button class="secondary-btn"
      onclick="toggleBestThirdLock()"
      id="bestThirdLockBtn">
      Lock
    </button>

    <p id="bestThirdStatus"></p>
  </div>
  `;

  html += `
<div class="admin-box" style="margin-top:30px;">
  <h3>Knockout Stage Lock</h3>

  <p id="knockoutLockStatus">Loading...</p>

  <button id="toggleKnockoutLockBtn"
    class="secondary-btn"
    onclick="toggleKnockoutLock()">
    Toggle
  </button>
</div>
`;

  // ================= R32 SECTION =================
  html += `
  <div class="admin-box" style="margin-top:40px;">
    <h2>Round of 32 (R32)</h2>

    <div id="r32Container"></div>

    <div id="r32Message" style="margin-top:15px; font-weight:bold;"></div>

    <button class="primary-btn" style="margin-top:20px;"
      onclick="saveAllR32Matches()">
      Save All R32 Matches
    </button>
  </div>
  `;

  // ================= R32 RESULTS SECTION =================
html += `
<div class="admin-box" style="margin-top:40px;">
  <h2>R32 Results (Select Winners)</h2>

  <div id="r32ResultsContainer"></div>

  <p id="r32ResultsMessage" style="margin-top:10px; font-weight:bold;"></p>
</div>
`;

// ================= R16 SECTION =================
html += `
<div class="admin-box" style="margin-top:40px;">
  <h2>Round of 16 (R16)</h2>

  <div id="r16Container"></div>

  <div id="r16Message" style="margin-top:15px; font-weight:bold;"></div>
</div>
`;

// ================= QF SECTION =================
html += `
<div class="admin-box" style="margin-top:40px;">
  <h2>Quarter Finals (QF)</h2>

  <div id="qfContainer"></div>

  <div id="qfMessage" style="margin-top:15px; font-weight:bold;"></div>
</div>
`;

// ================= SF SECTION =================
html += `
<div class="admin-box" style="margin-top:40px;">
  <h2>Semi Finals (SF)</h2>

  <div id="sfContainer"></div>

  <div id="sfMessage" style="margin-top:15px; font-weight:bold;"></div>
</div>
`;

// ================= FINAL SECTION =================
html += `
<div class="admin-box" style="margin-top:40px;">
  <h2>Finals</h2>

  <div id="finalContainer"></div>

  <div id="finalMessage" style="margin-top:15px; font-weight:bold;"></div>
</div>
`;

  container.innerHTML = html;

  listenGroupLocks();
  setupAdminGroupValidation();
  listenBestThirdLock();

  setTimeout(() => {
    renderBestThirdAdmin();
    updateBestThirdAvailability();
    loadSavedBracketData();

    // ✅ R32 render trigger
    renderR32Admin();
    loadR32ResultsAdmin();
    renderR16Admin();
    renderQFAdmin();
    renderSFAdmin();
    renderFinalAdmin();
    listenKnockoutLock();
  }, 0);
}

function loadSavedGroupsAdmin() {

  database.ref("bracketResults/groups").once("value")
    .then(snapshot => {

      if (!snapshot.exists()) return;

      const data = snapshot.val();

      Object.keys(data).forEach(group => {

        const first = data[group].first;
        const second = data[group].second;

        const firstSelect = document.getElementById(`admin_${group}_1`);
        const secondSelect = document.getElementById(`admin_${group}_2`);

        if (firstSelect) firstSelect.value = first;
        if (secondSelect) secondSelect.value = second;

      });

      // After loading, update availability
      updateBestThirdAvailability();
      buildQualified32();

    });
}

function loadSavedBestThirdAdmin() {

  database.ref("bracketResults/bestThird/actual")
    .once("value")
    .then(snapshot => {

      if (!snapshot.exists()) return;

      const teams = snapshot.val();

      document.querySelectorAll(".adminThirdCheck").forEach(cb => {

        if (teams.includes(cb.value)) {
          cb.checked = true;
        }

      });

      // Update counter
      document.getElementById("adminThirdCount").innerText =
        `Selected: ${teams.length} / 8`;

      buildQualified32();

    });
}

function loadSavedBracketData() {

  // LOAD GROUP RESULTS
  database.ref("bracketResults/groups").once("value").then(snap => {

    if (!snap.exists()) return;

    const data = snap.val();

    Object.keys(data).forEach(group => {

      const first = data[group].first;
      const second = data[group].second;

      const firstSelect = document.getElementById(`admin_${group}_1`);
      const secondSelect = document.getElementById(`admin_${group}_2`);

      if (firstSelect) firstSelect.value = first;
      if (secondSelect) secondSelect.value = second;

    });

    updateBestThirdAvailability();
setTimeout(buildQualified32, 200);
  });

  // LOAD BEST 3RD TEAMS
  database.ref("bracketResults/bestThird/actual").once("value").then(snap => {

    if (!snap.exists()) return;

    const teams = snap.val();

    document.querySelectorAll(".adminThirdCheck").forEach(cb => {
      if (teams.includes(cb.value)) {
        cb.checked = true;
      }
    });
    buildQualified32();

    document.getElementById("adminThirdCount").innerText =
      `Selected: ${teams.length} / 8`;

  });

}

function submitBracketResults() {

  let results = {};

  Object.keys(GROUPS).forEach(group => {

    const first = document.getElementById(`admin_${group}_1`).value;
    const second = document.getElementById(`admin_${group}_2`).value;

    if (!first || !second) {
      alert("Fill all groups first");
      return;
    }

    results[group] = {
      first,
      second
    };
  });

  database.ref("bracketResults/groups").set(results)
    .then(() => {
      alert("Bracket results saved!");
    });
}

function recalcTotal(uid) {

  database.ref("users/" + uid).once("value").then(snap => {

    const user = snap.val();

    const match = user.points?.match || 0;
    const bracket = user.points?.bracket || 0;

    database.ref("users/" + uid + "/points/total").set(match + bracket);
  });
}

function listenGroupLocks() {

  Object.keys(GROUPS).forEach(group => {

    database.ref("bracketResults/lock/groups/" + group)
      .on("value", snap => {

        const locked = snap.val() === true;

        const status = document.getElementById("status_" + group);
        const btn = document.getElementById("lockBtn_" + group);

        if (!status || !btn) return;

        if (locked) {
          status.innerText = "🔴 Locked (Users)";
          btn.innerText = "Unlock";
        } else {
          status.innerText = "🟢 Open (Users)";
          btn.innerText = "Lock";
        }

      });

  });
}

function submitSingleGroup(group) {

  const first = document.getElementById(`admin_${group}_1`).value;
  const second = document.getElementById(`admin_${group}_2`).value;

  if (!first || !second) {
    alert("Select both teams");
    return;
  }

  if (first === second) {
    alert("1st and 2nd cannot be same team");
    return;
  }

  // SAVE ONLY RESULT (NO LOCK HERE)
  database.ref("bracketResults/groups/" + group).set({
    first,
    second
  }).then(() => {

    calculateGroupPoints(group);
    alert("Group " + group + " result submitted!");

  });
}

function toggleGroupLock(group) {

  const lockRef = database.ref("bracketResults/lock/groups/" + group);

  lockRef.once("value").then(snap => {

    const isLocked = snap.val() === true;

    lockRef.set(!isLocked);

  });
}

function calculateGroupPoints(group) {

  database.ref("bracketResults/groups/" + group).once("value")
    .then(actualSnap => {

      const actual = actualSnap.val();
      if (!actual) return;

      database.ref("users").once("value")
        .then(usersSnap => {

          usersSnap.forEach(userChild => {

            const uid = userChild.key;

            database.ref(`bracket/groups/${uid}/${group}`)
              .once("value")
              .then(userSnap => {

                const user = userSnap.val();
                if (!user) return;

                let points = 0;

                if (user.first === actual.first) points += 3;
                if (user.second === actual.second) points += 3;

                database.ref(`users/${uid}/bracketPoints/${group}`)
                  .set(points)
                  .then(() => recalcBracketTotal(uid));
              });
          });
        });
    });
}

function renderBestThirdAdmin() {

  const container = document.getElementById("adminBestThirdContainer");
  if (!container) return;

  let html = "";

  Object.keys(GROUPS).forEach(group => {
    GROUPS[group].forEach(team => {
      html += `
        <div>
          <input type="checkbox" value="${team}" class="adminThirdCheck">
          <span>${team}</span>
        </div>
      `;
    });
  });

  container.innerHTML = html;

  setupAdminThirdLimit();
  updateBestThirdAvailability(); // keep ONLY this
}

function setupAdminThirdLimit() {

  document.querySelectorAll(".adminThirdCheck").forEach(cb => {

    cb.addEventListener("change", () => {

      const checked = document.querySelectorAll(".adminThirdCheck:checked");

      if (checked.length > 8) {
        cb.checked = false;
        alert("Only 8 teams allowed");
      }

      document.getElementById("adminThirdCount").innerText =
        `Selected: ${checked.length} / 8`;
        updateBestThirdAvailability();
    });

  });

}

function submitBestThirdActual() {

  const checked = document.querySelectorAll(".adminThirdCheck:checked");

  if (checked.length !== 8) {
    alert("Select exactly 8 teams");
    return;
  }

  let actualTeams = [];
  checked.forEach(cb => actualTeams.push(cb.value));

  database.ref("bracketResults/bestThird/actual")
    .set(actualTeams)
    .then(() => {

      calculateBestThirdPoints(actualTeams);
      alert("Best 3rd teams submitted!");

    });
}

function calculateBestThirdPoints(actualTeams) {

  database.ref("users").once("value").then(usersSnap => {

    usersSnap.forEach(userChild => {

      const uid = userChild.key;

      database.ref("bracket/bestThird/" + uid)
        .once("value")
        .then(userSnap => {

          if (!userSnap.exists()) return;

          const userSelected = userSnap.val().selected || [];

          let points = 0;

          userSelected.forEach(team => {
            if (actualTeams.includes(team)) {
              points += 3;
            }
          });

          database.ref(`users/${uid}/bracketPoints/bestThird`)
            .set(points)
            .then(() => recalcBracketTotal(uid));

        });

    });

  });
}

function toggleBestThirdLock() {

  const lockRef = database.ref("bracketResults/lock/bestThird");

  lockRef.once("value").then(snap => {

    const isLocked = snap.val() === true;

    lockRef.set(!isLocked);

  });
}

function listenBestThirdLock() {

  database.ref("bracketResults/lock/bestThird")
    .on("value", snap => {

      const locked = snap.val() === true;

      const status = document.getElementById("bestThirdStatus");
      const btn = document.getElementById("bestThirdLockBtn");

      if (!status || !btn) return;

      if (locked) {
        status.innerText = "🔴 Locked (Users)";
        btn.innerText = "Unlock";
      } else {
        status.innerText = "🟢 Open (Users)";
        btn.innerText = "Lock";
      }

    });
}

function recalcBracketTotal(uid) {

  database.ref(`users/${uid}/bracketPoints`)
    .once("value")
    .then(snap => {

      let total = 0;

      snap.forEach(child => {
        total += child.val();
      });

      database.ref(`users/${uid}/points/bracket`)
        .set(total)
        .then(() => recalcTotal(uid));
    });
}

function setupAdminGroupValidation() {

  Object.keys(GROUPS).forEach(group => {

    const firstSelect = document.getElementById(`admin_${group}_1`);
    const secondSelect = document.getElementById(`admin_${group}_2`);

    if (!firstSelect || !secondSelect) return;

    function validateGroup() {

      const first = firstSelect.value;
      const second = secondSelect.value;

      if (first && second && first === second) {
        alert("1st and 2nd cannot be same team");
        secondSelect.value = "";
      }

      // ONLY DATA UPDATE (NO UI RELOADS)
      updateBestThirdAvailability();
      buildQualified32(); // safe now because it's data-only
    }

    firstSelect.addEventListener("change", validateGroup);
    secondSelect.addEventListener("change", validateGroup);

  });
}

function updateBestThirdAvailability() {

  let selectedTeams = [];

  // Collect all selected 1st & 2nd teams
  Object.keys(GROUPS).forEach(group => {

    const first = document.getElementById(`admin_${group}_1`)?.value;
    const second = document.getElementById(`admin_${group}_2`)?.value;

    if (first) selectedTeams.push(first);
    if (second) selectedTeams.push(second);
  });

  // Disable those in Best 3rd
  document.querySelectorAll(".adminThirdCheck").forEach(cb => {

    if (selectedTeams.includes(cb.value)) {
      cb.checked = false;
      cb.disabled = true;
    } else {
      cb.disabled = false;
    }

  });
}

function buildQualified32() {

  const pool = [];

  Object.keys(GROUPS).forEach(group => {

    const first = document.getElementById(`admin_${group}_1`)?.value;
    const second = document.getElementById(`admin_${group}_2`)?.value;

    if (first) pool.push(first);
    if (second) pool.push(second);
  });

  document.querySelectorAll(".adminThirdCheck:checked")
    .forEach(cb => pool.push(cb.value));

  const qualified = [...new Set(pool)];

  window.QUALIFIED_32 = qualified;

  // 🔥 ADD THIS LINE (VERY IMPORTANT)
  setTimeout(renderR32Admin, 0);

  return qualified;
}

function renderR32Admin() {

  const container = document.getElementById("r32Container");
  const message = document.getElementById("r32Message");

  if (!container || !message) return;

  // 🔥 SAFE DEFAULT FIRST
  const teams = (window.QUALIFIED_32 || []);

  console.log("QUALIFIED 32 TEAMS:", teams);
  console.log("COUNT:", teams.length);

  // ❌ Not ready
  if (teams.length !== 32) {
    container.innerHTML = "";
    message.innerText = "Complete Groups & Best 3rd first";
    return;
  }

  message.innerText = "";

  // ✅ Match descriptions
  const matches = [
    { no: 73, text: "Runner-up Group A vs Runner-up Group B" },
    { no: 74, text: "Winner Group E vs 3rd Group A/B/C/D/F" },
    { no: 75, text: "Winner Group F vs Runner-up Group C" },
    { no: 76, text: "Winner Group C vs Runner-up Group F" },
    { no: 77, text: "Winner Group I vs 3rd Group C/D/F/G/H" },
    { no: 78, text: "Runner-up Group E vs Runner-up Group I" },
    { no: 79, text: "Winner Group A vs 3rd Group C/E/F/H/I" },
    { no: 80, text: "Winner Group L vs 3rd Group E/H/I/J/K" },
    { no: 81, text: "Winner Group D vs 3rd Group B/E/F/I/J" },
    { no: 82, text: "Winner Group G vs 3rd Group A/E/H/I/J" },
    { no: 83, text: "Runner-up Group K vs Runner-up Group L" },
    { no: 84, text: "Winner Group H vs Runner-up Group J" },
    { no: 85, text: "Winner Group B vs 3rd Group E/F/G/I/J" },
    { no: 86, text: "Winner Group J vs Runner-up Group H" },
    { no: 87, text: "Winner Group K vs 3rd Group D/E/I/J/L" },
    { no: 88, text: "Runner-up Group D vs Runner-up Group G" }
  ];

  let html = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:15px;">
  `;

  matches.forEach(match => {

    html += `
      <div class="admin-box">
        <strong>Match ${match.no}</strong><br><br>

        <select class="r32Select" id="r32_${match.no}_A">
          <option value="">Select Team</option>
          ${teams.map(t => `<option value="${t}">${t}</option>`).join("")}
        </select>

        <span style="margin:0 5px;">vs</span>

        <select class="r32Select" id="r32_${match.no}_B">
          <option value="">Select Team</option>
          ${teams.map(t => `<option value="${t}">${t}</option>`).join("")}
        </select>

        <br><br>
        <small>${match.text}</small>
      </div>
    `;
  });

  html += `</div>`;

  container.innerHTML = html;

  setupR32DuplicateControl();
  loadSavedR32();
}

function setupR32DuplicateControl() {

  const selects = document.querySelectorAll(".r32Select");

  selects.forEach(select => {
    select.addEventListener("change", updateR32Availability);
  });

  updateR32Availability();
}

function updateR32Availability() {

  const selects = document.querySelectorAll(".r32Select");

  let selected = [];

  selects.forEach(sel => {
    if (sel.value) selected.push(sel.value);
  });

  selects.forEach(sel => {

    const current = sel.value;

    Array.from(sel.options).forEach(opt => {

      if (!opt.value) return;

      if (opt.value === current) {
        opt.disabled = false;
      } else if (selected.includes(opt.value)) {
        opt.disabled = true;
      } else {
        opt.disabled = false;
      }

    });

  });
}

function saveAllR32Matches() {

  const matches = {};

  for (let i = 73; i <= 88; i++) {

    const teamA = document.getElementById(`r32_${i}_A`).value;
    const teamB = document.getElementById(`r32_${i}_B`).value;

    if (!teamA || !teamB) {
      alert("Fill all R32 matches");
      return;
    }

    matches[i] = { teamA, teamB };
  }

  database.ref("bracketResults/r32")
    .set(matches)
    .then(() => {
      alert("R32 matches saved!");
    });
}

function loadSavedR32() {

  database.ref("bracketResults/r32").once("value")
    .then(snap => {

      if (!snap.exists()) return;

      const data = snap.val();

      Object.keys(data).forEach(matchNo => {

        const match = data[matchNo];

        const a = document.getElementById(`r32_${matchNo}_A`);
        const b = document.getElementById(`r32_${matchNo}_B`);

        if (a) a.value = match.teamA;
        if (b) b.value = match.teamB;
      });

      updateR32Availability();
    });
}

function loadR32ResultsAdmin() {

  const container = document.getElementById("r32ResultsContainer");
  const message = document.getElementById("r32ResultsMessage");

  if (!container || !message) return;

  database.ref("bracketResults/r32").once("value")
    .then(snapshot => {

      // ❌ No R32 yet
      if (!snapshot.exists()) {
        container.innerHTML = "";
        message.innerText = "Create R32 matches first";
        return;
      }

      const data = snapshot.val();

      message.innerText = "";

      let html = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:15px;">
      `;

      Object.keys(data).forEach(matchNo => {

        const match = data[matchNo];

        html += `
          <div class="admin-box">
            <strong>Match ${matchNo}</strong><br><br>

            <b>${match.teamA}</b>
            <span> vs </span>
            <b>${match.teamB}</b>

            <br><br>

            <select onchange="saveR32Winner('${matchNo}', this.value)">
              <option value="">Select Winner</option>
              <option value="${match.teamA}">${match.teamA}</option>
              <option value="${match.teamB}">${match.teamB}</option>
            </select>

          </div>
        `;
      });

      html += `</div>`;

      container.innerHTML = html;

      // 🔥 Load already saved winners (if any)
      loadSavedR32Winners();
    });
}

function saveR32Winner(matchNo, winner) {

  if (!winner) return;

  database.ref("bracketResults/r32Winners/" + matchNo)
    .set(winner)
    .then(() => {
  calculateKnockoutPoints("r32", matchNo, winner, 5);
});
}

function loadSavedR32Winners() {

  database.ref("bracketResults/r32Winners").once("value")
    .then(snapshot => {

      if (!snapshot.exists()) return;

      const data = snapshot.val();

      Object.keys(data).forEach(matchNo => {

        const winner = data[matchNo];

        const select = document.querySelector(
          `select[onchange="saveR32Winner('${matchNo}', this.value)"]`
        );

        if (select) {
          select.value = winner;
        }
      });
    });
}

function renderR16Admin() {

  const container = document.getElementById("r16Container");
  const message = document.getElementById("r16Message");

  if (!container || !message) return;

  database.ref("bracketResults/r32Winners").on("value", snap => {

    const winners = snap.val() || {};

    // ❌ Not enough winners
    if (Object.keys(winners).length < 16) {
      container.innerHTML = "";
      message.innerText = "Waiting for all R32 winners...";
      return;
    }

    message.innerText = "";

    const mapping = [
      { no: 89, a: 73, b: 75 },
      { no: 90, a: 74, b: 77 },
      { no: 91, a: 76, b: 78 },
      { no: 92, a: 79, b: 80 },
      { no: 93, a: 83, b: 84 },
      { no: 94, a: 81, b: 82 },
      { no: 95, a: 86, b: 88 },
      { no: 96, a: 85, b: 87 }
    ];

    let html = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:15px;">
    `;

    mapping.forEach(match => {

      const teamA = winners[match.a] || "-";
      const teamB = winners[match.b] || "-";

      html += `
  <div class="admin-box">
    <strong>Match ${match.no}</strong><br><br>

    ${teamA} vs ${teamB}

    <br><br>

    <select id="r16_winner_${match.no}">
      <option value="">Select Winner</option>
      <option value="${teamA}">${teamA}</option>
      <option value="${teamB}">${teamB}</option>
    </select>
  </div>
`;
    });

    html += `</div>`;

    container.innerHTML = html;
    setupR16WinnerListeners();
    loadSavedR16Winners();

  });
}

function setupR16WinnerListeners() {

  for (let i = 89; i <= 96; i++) {

    const select = document.getElementById(`r16_winner_${i}`);
    if (!select) continue;

    select.addEventListener("change", () => {

      const winner = select.value;

      if (!winner) return;

        database.ref(`bracketResults/r16Winners/${i}`)
  .set(winner)
  .then(() => {
    calculateKnockoutPoints("r16", i, winner, 7);
  });
    });
  }
}

function loadSavedR16Winners() {

  database.ref("bracketResults/r16Winners")
    .once("value")
    .then(snap => {

      if (!snap.exists()) return;

      const data = snap.val();

      Object.keys(data).forEach(matchNo => {

        const select = document.getElementById(`r16_winner_${matchNo}`);
        if (select) {
          select.value = data[matchNo];
        }

      });

    });
}

function renderQFAdmin() {

  const container = document.getElementById("qfContainer");
  const message = document.getElementById("qfMessage");

  if (!container || !message) return;

  database.ref("bracketResults/r16Winners").on("value", snap => {

    const r16 = snap.val() || {};

    const required = [89,90,91,92,93,94,95,96];

    if (required.some(m => !r16[m])) {
      container.innerHTML = "";
      message.innerText = "Waiting for all R16 winners...";
      return;
    }

    message.innerText = "";

    const mapping = [
      { no: 97, a: 89, b: 90 },
      { no: 98, a: 93, b: 94 },
      { no: 99, a: 91, b: 92 },
      { no: 100, a: 95, b: 96 }
    ];

    let html = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:15px;">
    `;

    mapping.forEach(match => {

      const teamA = r16[match.a];
      const teamB = r16[match.b];

      html += `
        <div class="admin-box">
          <strong>Match ${match.no}</strong><br><br>

          ${teamA} vs ${teamB}

          <br><br>

          <select id="qf_winner_${match.no}">
            <option value="">Select Winner</option>
            <option value="${teamA}">${teamA}</option>
            <option value="${teamB}">${teamB}</option>
          </select>
        </div>
      `;
    });

    html += `</div>`;

    container.innerHTML = html;

    setupQFWinnerListeners();
    loadSavedQFWinners();

  });
}

function setupQFWinnerListeners() {

  for (let i = 97; i <= 100; i++) {

    const select = document.getElementById(`qf_winner_${i}`);
    if (!select) continue;

    select.addEventListener("change", () => {

      const winner = select.value;
      if (!winner) return;

      database.ref(`bracketResults/qfWinners/${i}`)
  .set(winner)
  .then(() => {
    calculateKnockoutPoints("qf", i, winner, 10);
  });
    });
  }
}

function loadSavedQFWinners() {

  database.ref("bracketResults/qfWinners")
    .once("value")
    .then(snap => {

      if (!snap.exists()) return;

      const data = snap.val();

      Object.keys(data).forEach(matchNo => {

        const select = document.getElementById(`qf_winner_${matchNo}`);
        if (select) select.value = data[matchNo];

      });

    });
}

function renderSFAdmin() {

  const container = document.getElementById("sfContainer");
  const message = document.getElementById("sfMessage");

  if (!container || !message) return;

  database.ref("bracketResults/qfWinners").on("value", snap => {

    const qf = snap.val() || {};

    const required = [97,98,99,100];

    if (required.some(m => !qf[m])) {
      container.innerHTML = "";
      message.innerText = "Waiting for all QF winners...";
      return;
    }

    message.innerText = "";

    const mapping = [
      { no: 101, a: 97, b: 98 },
      { no: 102, a: 99, b: 100 }
    ];

    let html = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:15px;">
    `;

    mapping.forEach(match => {

      const teamA = qf[match.a];
      const teamB = qf[match.b];

      html += `
        <div class="admin-box">
          <strong>Match ${match.no}</strong><br><br>

          ${teamA} vs ${teamB}

          <br><br>

          <select id="sf_winner_${match.no}">
            <option value="">Select Winner</option>
            <option value="${teamA}">${teamA}</option>
            <option value="${teamB}">${teamB}</option>
          </select>
        </div>
      `;
    });

    html += `</div>`;

    container.innerHTML = html;

    setupSFWinnerListeners();
    loadSavedSFWinners();

  });
}

function setupSFWinnerListeners() {

  for (let i = 101; i <= 102; i++) {

    const select = document.getElementById(`sf_winner_${i}`);
    if (!select) continue;

    select.addEventListener("change", () => {

      const value = select.value;
      if (!value) return;

      // safer way: read options
      const options = select.options;
      const teamA = options[1].value;
      const teamB = options[2].value;

      const winner = value;
      const loser = (value === teamA) ? teamB : teamA;

      // SAVE LOSER
      database.ref(`bracketResults/sfLosers/${i}`).set(loser);

      database.ref(`bracketResults/sfWinners/${i}`)
  .set(winner)
  .then(() => {
    calculateKnockoutPoints("sf", i, winner, 15);
  });

    });
  }
}

function loadSavedSFWinners() {

  database.ref("bracketResults/sfWinners").once("value")
    .then(snap => {

      if (!snap.exists()) return;

      const data = snap.val();

      Object.keys(data).forEach(matchNo => {

        const select = document.getElementById(`sf_winner_${matchNo}`);
        if (select) select.value = data[matchNo];

      });

    });

  // 🔥 NEW: also load losers (for 3rd place later)
  database.ref("bracketResults/sfLosers").once("value")
    .then(snap => {
      if (!snap.exists()) return;

      window.SF_LOSERS = snap.val();
    });
}

function renderFinalAdmin() {

  const container = document.getElementById("finalContainer");
  const message = document.getElementById("finalMessage");

  if (!container || !message) return;

  database.ref("bracketResults/sfWinners").on("value", snap => {

  const sf = snap.val() || {};

  const required = [101, 102];

  if (required.some(m => !sf[m])) {
    container.innerHTML = "";
    message.innerText = "Waiting for Semi Final results...";
    return;
  }

  message.innerText = "";

  const sf1Winner = sf[101];
  const sf2Winner = sf[102];

  // ✅ FETCH LOSERS PROPERLY (FIX)
  database.ref("bracketResults/sfLosers").once("value").then(loserSnap => {

    const losers = loserSnap.val() || {};

    const sf1Loser = losers[101] || "TBD";
    const sf2Loser = losers[102] || "TBD";

    let html = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:15px;">
    `;

    // 🥉 3rd place
    html += `
      <div class="admin-box">
        <strong>Match 103 (3rd Place)</strong><br><br>

        ${sf1Loser} vs ${sf2Loser}

        <br><br>

        <select id="final_winner_103">
          <option value="">Select Winner</option>
          <option value="${sf1Loser}">${sf1Loser}</option>
          <option value="${sf2Loser}">${sf2Loser}</option>
        </select>
      </div>
    `;

    // 🏆 FINAL
    html += `
      <div class="admin-box">
        <strong>Match 104 (Final)</strong><br><br>

        ${sf1Winner} vs ${sf2Winner}

        <br><br>

        <select id="final_winner_104">
          <option value="">Select Winner</option>
          <option value="${sf1Winner}">${sf1Winner}</option>
          <option value="${sf2Winner}">${sf2Winner}</option>
        </select>
      </div>
    `;

    html += `</div>`;

    container.innerHTML = html;

    setupFinalListeners();
    loadSavedFinalWinners();
  });
});
}

function setupFinalListeners() {

  const m103 = document.getElementById("final_winner_103");
  const m104 = document.getElementById("final_winner_104");

  if (m103) {
  m103.addEventListener("change", () => {
    const val = m103.value;
    database.ref("bracketResults/finalWinners/103")
      .set(val)
      .then(() => {
        calculateKnockoutPoints("final", 103, val, 10);
      });
  });
}

if (m104) {
  m104.addEventListener("change", () => {
    const val = m104.value;
    database.ref("bracketResults/finalWinners/104")
      .set(val)
      .then(() => {
        calculateKnockoutPoints("final", 104, val, 20);
      });
  });
}
}

function loadSavedFinalWinners() {

  database.ref("bracketResults/finalWinners")
    .once("value")
    .then(snap => {

      if (!snap.exists()) return;

      const data = snap.val();

      if (document.getElementById("final_winner_103")) {
        document.getElementById("final_winner_103").value = data[103] || "";
      }

      if (document.getElementById("final_winner_104")) {
        document.getElementById("final_winner_104").value = data[104] || "";
      }

    });
}

function toggleKnockoutLock() {

  const lockRef = database.ref("bracketResults/lock/knockout");

  lockRef.once("value").then(snap => {

    const isLocked = snap.val() === true;

    lockRef.set(!isLocked);

  });

}

function listenKnockoutLock() {

  database.ref("bracketResults/lock/knockout")
    .on("value", snap => {

      const locked = snap.val() === true;

      const status = document.getElementById("knockoutLockStatus");
      const btn = document.getElementById("toggleKnockoutLockBtn");

      if (!status || !btn) return;

      if (locked) {
        status.innerText = "🔴 Knockout Locked (Users)";
        btn.innerText = "Unlock Knockout";
      } else {
        status.innerText = "🟢 Knockout Open (Users)";
        btn.innerText = "Lock Knockout";
      }

    });

}

function calculateKnockoutPoints(stage, matchNo, actualWinner, pointsPerCorrect) {

  database.ref("users").once("value").then(usersSnap => {

    usersSnap.forEach(userChild => {

      const uid = userChild.key;

      database.ref(`bracket/${stage}/${uid}/${matchNo}`)
        .once("value")
        .then(userSnap => {

          if (!userSnap.exists()) return;

          const userPrediction = userSnap.val();

          let points = 0;

          if (userPrediction === actualWinner) {
            points = pointsPerCorrect;
          }

          database.ref(`users/${uid}/bracketPoints/${stage}_${matchNo}`)
            .set(points)
            .then(() => recalcBracketTotal(uid));

        });

    });

  });

}

function resetUserPassword(uid) {

  const newPass = prompt("Enter temporary password (4–6 characters)");

  if (!newPass) return;

  if (newPass.length < 4 || newPass.length > 6) {
    alert("Password must be 4 to 6 characters");
    return;
  }

  database.ref("users/" + uid).update({
    password: newPass,
    mustChangePassword: true
  }).then(() => {
    alert("Password reset successfully");
  });

}