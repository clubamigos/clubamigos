const database = firebase.database();

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

/* ================= MODALS ================= */

function openLogin() {
  document.getElementById("loginPhone").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginModal").style.display = "block";
}

function closeModal() {
  document.getElementById("loginModal").style.display = "none";
}

function closeAdminModal() {
  document.getElementById("adminModal").style.display = "none";
  document.getElementById("adminPassword").value = "";
}

/* ================= DATE FORMAT ================= */

function formatDate(inputDate) {
  const d = new Date(inputDate);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/* ================= LOGIN ================= */

function login() {

  const phone = document.getElementById("loginPhone").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!phone || !password) {
    alert("Fill all fields");
    return;
  }

  database.ref("users")
    .orderByChild("phone")
    .equalTo(phone)
    .once("value")
    .then((snapshot) => {

      if (!snapshot.exists()) {
        alert("Invalid phone or password");
        return;
      }

      let userFound = null;

      snapshot.forEach((child) => {
        const user = child.val();
        if (user.password === password) {
  userFound = {
    uid: child.key,
    username: user.username,
    mustChangePassword: user.mustChangePassword || false
  };
}
      });

      if (userFound) {
        localStorage.setItem("uid", userFound.uid);
        localStorage.setItem("username", userFound.username);
        if (userFound.mustChangePassword) {
    showChangePasswordModal(userFound.uid);
    return; // ⛔ STOP normal flow
  }
        showUser(userFound.username);
      } else {
        alert("Invalid phone or password");
      }

    });
}

/* ================= SHOW USER ================= */

function showUser(username) {

  document.getElementById("guestView").classList.add("hidden");
  document.getElementById("userView").classList.remove("hidden");

  document.getElementById("welcomeText").innerText = "Welcome, " + username;

  closeModal();

  // 🔥 Reload everything properly
  loadMatchesForUsers();
  loadLeaderboard();

  // 🔥 IMPORTANT: Re-render current page content
  const activePage = document.querySelector(".page-section:not(.hidden)");
  if (activePage) {
    navigate(activePage.id);
  }
}

/* ================= LOGOUT ================= */

function logout() {

  localStorage.removeItem("uid");
  localStorage.removeItem("username");

  document.getElementById("guestView").classList.remove("hidden");
  document.getElementById("userView").classList.add("hidden");

  navigate("leaderboard");
  loadMatchesForUsers();
}

/* ================= AUTO LOAD ================= */

window.onload = function () {

  const username = localStorage.getItem("username");

  if (username) {
    showUser(username);
  }

  navigate("leaderboard");
  loadLeaderboard();
  loadMatchesForUsers();
};

/* ================= NAVIGATION ================= */

function navigate(pageId) {

  document.querySelectorAll(".page-section").forEach(section => {
    section.classList.add("hidden");
  });

  document.getElementById(pageId).classList.remove("hidden");

  if (pageId === "bracket") {
    loadBracketUI();
  }
}

/* ================= ADMIN ACCESS ================= */

let clickCount = 0;
let clickTimer = null;

document.getElementById("logoTrigger").addEventListener("click", () => {

  clickCount++;

  if (clickCount === 1) {
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 2000);
  }

  if (clickCount === 5) {
    clearTimeout(clickTimer);
    clickCount = 0;
    document.getElementById("adminModal").style.display = "block";
  }

});

/* ================= VERIFY ADMIN ================= */

function verifyAdmin() {

  const pass = document.getElementById("adminPassword").value.trim();

  database.ref("adminSettings/adminPassword")
    .once("value")
    .then((snapshot) => {

      const realPassword = snapshot.val();

      if (pass === realPassword) {

        sessionStorage.setItem("isAdmin", "true");
        window.location.href = "admin.html";

      } else {

        alert("Access denied");

      }

    });

}

/* ================= LEADERBOARD ================= */

function loadLeaderboard() {

  database.ref("users").on("value", (snapshot) => {

    let users = [];

    snapshot.forEach(child => {
      users.push(child.val());
    });

    users.sort((a, b) => {
      return (b.points?.total || 0) - (a.points?.total || 0);
    });

    const body = document.getElementById("leaderboardBody");
    body.innerHTML = "";

    users.forEach((user, index) => {

      const matchPoints = user.points?.match || 0;
      const bracketPoints = user.points?.bracket || 0;
      const totalPoints = user.points?.total || 0;

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${user.username}</td>
        <td>${matchPoints}</td>
        <td>${bracketPoints}</td>
        <td>${totalPoints}</td>
      `;

      body.appendChild(row);
    });

  });
}

/* ================= LOAD MATCHES ================= */

function loadMatchesForUsers() {

  const uid = localStorage.getItem("uid");

  database.ref("matches").once("value").then((snapshot) => {

    const container = document.getElementById("matchesContainer");
    container.innerHTML = "";

    if (!snapshot.exists()) {
      container.innerHTML = "<p>No matches available.</p>";
      return;
    }

    // 🔥 Convert snapshot to array
    let matchesArray = [];

    snapshot.forEach(child => {
      matchesArray.push({
        id: child.key,
        data: child.val()
      });
    });

    // 🔥 Sort ASCENDING (match 1 → top)
matchesArray.sort((a, b) => {
  return Number(a.data.matchNo) - Number(b.data.matchNo);
});

    // 🔥 Render sorted matches
    matchesArray.forEach(item => {

      const match = item.data;
      const matchId = item.id;

      const card = document.createElement("div");
      card.className = "match-card";

      if (uid) {

        database.ref("predictions/" + matchId + "/" + uid)
          .once("value")
          .then((snap) => {

            const prediction = snap.val();
            const savedA = prediction ? prediction.scoreA : "";
            const savedB = prediction ? prediction.scoreB : "";

            renderMatchCard(match, matchId, card, savedA, savedB, uid);

          });

      } else {

        renderMatchCard(match, matchId, card, "", "", uid);

      }

      container.appendChild(card);

    });

  });

}

/* ================= RENDER MATCH CARD ================= */

function renderMatchCard(match, matchId, card, savedA, savedB, uid) {

  let predictionHTML = "";

  if (!match.locked) {

    if (uid) {

      predictionHTML = `
        <div class="prediction-row">
          <input type="number" id="scoreA_${matchId}" value="${savedA}" min="0">
          <span>-</span>
          <input type="number" id="scoreB_${matchId}" value="${savedB}" min="0">
          <button class="primary-btn" onclick="savePrediction('${matchId}')">
            Save
          </button>
        </div>
      `;

    } else {

      predictionHTML = `<p><i>Login to predict</i></p>`;
    }

  } else {

    predictionHTML = `
      <p><b>Prediction Closed</b></p>
    `;
  }

  card.innerHTML = `
    <div class="match-header">
      <b>MATCH NO: ${match.matchNo}</b>
    </div>

    <div class="match-info">
      <p><b>DATE:</b> ${formatDate(match.date)}</p>
      <p><b>STAGE:</b> ${formatGroup(match.group)}</p>
      <p><b>${match.teamA} vs ${match.teamB}</b></p>
    </div>

    ${predictionHTML}

    ${match.locked ? `
      <button class="secondary-btn" onclick="viewPredictions('${matchId}')">
        View Predictions
      </button>
    ` : ""}
  `;
}

/* ================= SAVE PREDICTION ================= */

function savePrediction(matchId) {

  const uid = localStorage.getItem("uid");

  if (!uid) {
    alert("Login required");
    return;
  }

  const scoreA = document.getElementById("scoreA_" + matchId).value;
  const scoreB = document.getElementById("scoreB_" + matchId).value;

  if (scoreA === "" || scoreB === "") {
    alert("Enter both scores");
    return;
  }

  database.ref("predictions/" + matchId + "/" + uid).set({
    scoreA: parseInt(scoreA),
    scoreB: parseInt(scoreB),
    updatedAt: Date.now()
  }).then(() => {
    alert("Prediction saved");
  });

}

/* ================= CLOSE MODAL ================= */

function closePredictionModal() {
  document.getElementById("predictionModal").style.display = "none";
}

/* ================= VIEW PREDICTIONS ================= */

function viewPredictions(matchId) {

  const tableDiv = document.getElementById("predictionTable");
  const title = document.getElementById("modalTitle");

  tableDiv.innerHTML = "Loading...";

  database.ref("matches/" + matchId).once("value").then(matchSnap => {

    if (!matchSnap.exists()) {
      tableDiv.innerHTML = "Match not found";
      return;
    }

    const matchData = matchSnap.val();

    const teamA = matchData.teamA;
    const teamB = matchData.teamB;

    const isFinished = matchData.finished === true;
    const actualA = matchData.scoreA;
    const actualB = matchData.scoreB;

    // ✅ Modal Title
    let headerText = `Match ${matchData.matchNo} Predictions`;

    if (isFinished) {
      headerText += ` | Final Score: ${teamA} ${actualA} - ${actualB} ${teamB}`;
    }

    title.innerText = headerText;

    database.ref("predictions/" + matchId).once("value").then(predSnap => {

      if (!predSnap.exists()) {
        tableDiv.innerHTML = "<p>No predictions yet</p>";
        return;
      }

      const promises = [];
      const rows = [];

      predSnap.forEach(child => {

        const userId = child.key;
        const prediction = child.val();

        const p = Promise.all([
          database.ref("users/" + userId).once("value"),
          database.ref("users/" + userId + "/matchPoints/" + matchId).once("value")
        ]).then(([userSnap, pointsSnap]) => {

          const userData = userSnap.val();
          const username = userData ? userData.username : "Unknown";

          const points = isFinished
            ? (pointsSnap.exists() ? pointsSnap.val() : 0)
            : "-";

          rows.push(`
            <tr>
              <td>${username}</td>
              <td>${prediction.scoreA}</td>
              <td>${prediction.scoreB}</td>
              <td>${points}</td>
            </tr>
          `);
        });

        promises.push(p);
      });

      Promise.all(promises).then(() => {

        tableDiv.innerHTML = `
          ${isFinished ? `
            <div class="final-score-box">
              <strong>Final Score:</strong> 
              ${teamA} ${actualA} - ${actualB} ${teamB}
            </div>
          ` : ""}

          <table class="pred-table">
            <thead>
              <tr>
                <th>User</th>
                <th>${teamA}</th>
                <th>${teamB}</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              ${rows.join("")}
            </tbody>
          </table>
        `;

        document.getElementById("predictionModal").style.display = "block";
      });

    });

  });

}

function loadBracketUI() {

  const container = document.getElementById("bracketContainer");
  const uid = localStorage.getItem("uid");

  let html = "";

  // GROUP STAGE SELECTION
  Object.keys(GROUPS).forEach(group => {

    html += `
      <div style="margin-top:20px; padding:15px; background:#111827; color:white; border-radius:10px;">
        <h3>Group ${group}</h3>

        <label>1st Place</label>
        <select id="g_${group}_1" onchange="if(!requireLogin()) { this.value=''; return; } validateGroupSelection('${group}')">
          <option value="">Select</option>
          ${GROUPS[group].map(t => `<option value="${t}">${t}</option>`).join("")}
        </select>

        <br><br>

        <label>2nd Place</label>
        <select id="g_${group}_2" onchange="if(!requireLogin()) { this.value=''; return; } validateGroupSelection('${group}')">
          <option value="">Select</option>
          ${GROUPS[group].map(t => `<option value="${t}">${t}</option>`).join("")}
        </select>

      </div>
    `;
  });

  // BEST 3RD PLACE
html += `
  <div style="margin-top:30px;">
    <h3>Select Best 3rd Teams (Max 8)</h3>
    <div id="thirdContainer" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px;">
`;

Object.keys(GROUPS).forEach(group => {
  GROUPS[group].forEach(team => {
    html += `
      <div class="third-team">
        <input type="checkbox" value="${team}" class="thirdCheck">
        <span>${team}</span>
      </div>
    `;
  });
});

html += `
    </div>
    <p id="thirdCount">Selected: 0 / 8</p>
  </div>
`;

// ✅ BUTTONS HERE (CORRECT POSITION)
html += `
  <div style="margin-top:20px;">
    <button id="saveBracketBtn"
      class="primary-btn"
      onclick="saveBracketPrediction()">
      Save Bracket
    </button>

    <br><br>

    <button id="viewGroupPredBtn"
      class="secondary-btn"
      style="display:none;"
      onclick="viewGroupPredictions()">
      View Group Predictions
    </button>
  </div>
`;

// 🔽 ADD KNOCKOUT SECTION (LOGIN REQUIRED)
if (uid) {

  html += `
    <div style="margin-top:40px;">
      <h2>Knockout Stage Prediction</h2>
      <div id="knockoutContainer"></div>
    </div>
  `;

} else {

  html += `
    <div style="margin-top:40px; text-align:center; color:white;">
      <h2>Knockout Stage Prediction</h2>
      <p style="margin-top:10px; opacity:0.7;">
        Login to view knockout stage predictions
      </p>
    </div>
  `;

}

  container.innerHTML = html;

  if (uid) {
  renderR32User();
}

  // LOAD SAVED DATA IF EXISTS
if (uid) {

  database.ref("bracket/groups/" + uid).once("value").then(snapshot => {

    if (snapshot.exists()) {
      const saved = snapshot.val();

      Object.keys(saved).forEach(group => {
        if (saved[group].first) {
          document.getElementById(`g_${group}_1`).value = saved[group].first;
        }
        if (saved[group].second) {
          document.getElementById(`g_${group}_2`).value = saved[group].second;
        }
      });
    }
    updateThirdAvailability();
    applyLocksManually();

  });

  database.ref("bracket/bestThird/" + uid).once("value").then(snapshot => {

    if (snapshot.exists()) {
      const savedThird = snapshot.val().selected || [];

      savedThird.forEach(team => {
        const checkbox = document.querySelector(
          `.thirdCheck[value="${team}"]`
        );
        if (checkbox) checkbox.checked = true;
      });

      document.getElementById("thirdCount").innerText =
        `Selected: ${savedThird.length} / 8`;
    }
    updateThirdAvailability();
    applyLocksManually();

  });

}

  // LIMIT BEST 3RD TO 8
  document.querySelectorAll(".thirdCheck").forEach(cb => {

  cb.addEventListener("click", (e) => {

    if (!requireLogin()) {
      e.preventDefault();
      cb.checked = false;
      return;
    }

  });

  cb.addEventListener("change", () => {

    const checked = document.querySelectorAll(".thirdCheck:checked");
    if (checked.length > 8) {
      cb.checked = false;
      alert("Only 8 teams allowed");
    }

    document.getElementById("thirdCount").innerText =
      `Selected: ${checked.length} / 8`;

  });

});
  updateThirdAvailability();
  listenGroupLocksForUser();
  listenBestThirdLockForUser();
  checkGroupPredictionExists();
  listenKnockoutLockUser();
}

function saveBracketPrediction() {

  const uid = localStorage.getItem("uid");
  if (!uid) {
    alert("Login required");
    return;
  }

  let groupData = {};
  let allGroupsFilled = true;
  let duplicateFound = false;

  Object.keys(GROUPS).forEach(group => {

    const first = document.getElementById(`g_${group}_1`).value;
    const second = document.getElementById(`g_${group}_2`).value;

    if (!first || !second) {
      allGroupsFilled = false;
    }

    // 🔴 NEW CHECK — Same team in 1st & 2nd
    if (first && second && first === second) {
      duplicateFound = true;
    }

    groupData[group] = {
      first: first,
      second: second
    };

  });

  if (!allGroupsFilled) {
    alert("Please select 1st and 2nd place for ALL groups.");
    return;
  }

  // 🔴 BLOCK SAME TEAM SELECTION
  if (duplicateFound) {
    alert("1st and 2nd place cannot be the same team in any group.");
    return;
  }

  // Collect best 3rd
  let bestThird = [];
  document.querySelectorAll(".thirdCheck:checked").forEach(cb => {
    bestThird.push(cb.value);
  });

  if (bestThird.length !== 8) {
    alert("Please select exactly 8 Best 3rd teams.");
    return;
  }

  // ✅ Save
  database.ref("bracket/groups/" + uid).set(groupData);
  database.ref("bracket/bestThird/" + uid).set({
    selected: bestThird
  }).then(() => {
    alert("Bracket saved successfully!");
  });

}

function validateGroupSelection(group) {

  const firstSelect = document.getElementById(`g_${group}_1`);
  const secondSelect = document.getElementById(`g_${group}_2`);

  const first = firstSelect.value;
  const second = secondSelect.value;

  if (first && second && first === second) {
    alert("1st and 2nd place cannot be the same team.");

    // 🔥 FIX: Reset second dropdown safely
    secondSelect.value = "";
    return;
  }

  // 🔥 Update third team availability
  updateThirdAvailability();
}

function updateThirdAvailability() {

  let selectedTeams = [];

  // Collect all selected 1st and 2nd teams
  Object.keys(GROUPS).forEach(group => {

    const first = document.getElementById(`g_${group}_1`).value;
    const second = document.getElementById(`g_${group}_2`).value;

    if (first) selectedTeams.push(first);
    if (second) selectedTeams.push(second);

  });

  // Loop all third checkboxes
  document.querySelectorAll(".thirdCheck").forEach(cb => {

    if (selectedTeams.includes(cb.value)) {
      cb.checked = false;
      cb.disabled = true;
      cb.parentElement.style.opacity = "0.5";
    } else {
      cb.disabled = false;
      cb.parentElement.style.opacity = "1";
    }

  });

  // Update counter
  const checked = document.querySelectorAll(".thirdCheck:checked");
  document.getElementById("thirdCount").innerText =
    `Selected: ${checked.length} / 8`;
}

function requireLogin() {

  const uid = localStorage.getItem("uid");

  if (!uid) {
    alert("Please login to continue.");
    return false;
  }

  return true;
}

function listenGroupLocksForUser() {

  Object.keys(GROUPS).forEach(group => {

    database.ref("bracketResults/lock/groups/" + group)
      .on("value", snap => {

        const locked = snap.val() === true;

        const select1 = document.getElementById(`g_${group}_1`);
        const select2 = document.getElementById(`g_${group}_2`);

        if (!select1 || !select2) return;

        select1.disabled = locked;
        select2.disabled = locked;

      });

  });
}

function listenBestThirdLockForUser() {

  database.ref("bracketResults/lock/bestThird")
    .on("value", snap => {

      const locked = snap.val() === true;

      document.querySelectorAll(".thirdCheck").forEach(cb => {
        cb.disabled = locked;
      });

    });
}

function applyLocksManually() {

  // GROUP LOCKS
  Object.keys(GROUPS).forEach(group => {

    database.ref("bracketResults/lock/groups/" + group)
      .once("value")
      .then(snap => {

        const locked = snap.val() === true;

        const select1 = document.getElementById(`g_${group}_1`);
        const select2 = document.getElementById(`g_${group}_2`);

        if (select1 && select2) {
          select1.disabled = locked;
          select2.disabled = locked;
        }

      });

  });

  // BEST 3RD LOCK
  database.ref("bracketResults/lock/bestThird")
    .once("value")
    .then(snap => {

      const locked = snap.val() === true;

      document.querySelectorAll(".thirdCheck").forEach(cb => {
        cb.disabled = locked;
      });

    });

}

function checkGroupPredictionExists() {

  const btn = document.getElementById("viewGroupPredBtn");
  if (!btn) return;

  database.ref("bracketResults/groups").once("value")
    .then(groupSnap => {

      const groupDataExists = groupSnap.exists();

      database.ref("bracketResults/bestThird/actual").once("value")
        .then(thirdSnap => {

          const thirdExists = thirdSnap.exists();

          if (groupDataExists || thirdExists) {
            btn.style.display = "block";
          } else {
            btn.style.display = "none";
          }

        });

    });
}

function viewGroupPredictions() {

  const container = document.getElementById("groupPredictionTable");
  container.innerHTML = "Loading...";

  Promise.all([
    database.ref("users").once("value"),
    database.ref("bracket/groups").once("value"),
    database.ref("bracket/bestThird").once("value")
  ]).then(([usersSnap, groupSnap, thirdSnap]) => {

    const users = usersSnap.val() || {};
    const groups = groupSnap.val() || {};
    const bestThird = thirdSnap.val() || {};

    console.log("USERS:", users);
console.log("GROUPS:", groups);
console.log("BEST THIRD:", bestThird);

    let html = `
      <div style="overflow-x:auto;">
      <table style="width:max-content; border-collapse:collapse; color:black; text-align:center;">
        <thead>
          <tr>
            <th style="padding:10px; border:1px solid #ccc; color:black; text-align:center;">User</th>
    `;

    // HEADERS
    Object.keys(GROUPS).forEach(g => {
      html += `
        <th style="padding:10px; border:1px solid #ccc; color:black; text-align:center;">${g} 1st</th>
        <th style="padding:10px; border:1px solid #ccc; color:black; text-align:center;">${g} 2nd</th>
      `;
    });

    html += `
        <th style="padding:10px; border:1px solid #ccc; color:black; text-align:center;">Best 3rd (8)</th>
      </tr>
      </thead>
      <tbody>
    `;

    // LOOP USERS
    Object.keys(users).forEach(uid => {

      const user = users[uid];

      const groupData = groups[uid] || {};
      const thirdData = bestThird[uid]?.selected || [];

      html += `<tr>`;

      // USER
      html += `<td style="padding:10px; border:1px solid #ccc; color:black; text-align:center;">
        ${user.username}
      </td>`;

      // GROUPS
      Object.keys(GROUPS).forEach(g => {

        const data = groupData[g] || {};

        html += `
          <td style="padding:10px; border:1px solid #ccc; color:black; text-align:center;">
            ${data.first ? data.first : "-"}
          </td>
          <td style="padding:10px; border:1px solid #ccc; color:black; text-align:center;">
            ${data.second ? data.second : "-"}
          </td>
        `;
      });

      // BEST 3RD
      html += `
        <td style="padding:10px; border:1px solid #ccc; color:black; text-align:center;">
          ${thirdData.length > 0 ? thirdData.join(", ") : "-"}
        </td>
      `;

      html += `</tr>`;
    });

    html += `
      </tbody>
      </table>
      </div>
    `;

    container.innerHTML = html;
    document.getElementById("groupPredictionModal").style.display = "block";

  });
}

function closeGroupPredictions() {
  document.getElementById("groupPredictionModal").style.display = "none";
}

function renderR32User() {

  const container = document.getElementById("knockoutContainer");
  const uid = localStorage.getItem("uid");

  if (!uid) {
  container.innerHTML = "<p><i>Login to view knockout stage predictions</i></p>";
  return;
}

  if (!container) return;

  database.ref("bracketResults/r32").on("value", snap => {

    const matches = snap.val() || {};

    if (!Object.keys(matches).length) {
      container.innerHTML = "<p>Waiting for R32 matches...</p>";
      return;
    }

    let html = `
      <div style="margin-top:20px;">
        <h3>Round of 32</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:15px;">
    `;

    Object.keys(matches).forEach(matchNo => {

      const match = matches[matchNo];
      const teamA = match.teamA;
      const teamB = match.teamB;

      html += `
        <div class="admin-box">
          <strong>Match ${matchNo}</strong><br><br>

          ${teamA} vs ${teamB}

          <br><br>

          <select class="knockout-select" id="user_r32_${matchNo}">
            <option value="">Select Winner</option>
            <option value="${teamA}">${teamA}</option>
            <option value="${teamB}">${teamB}</option>
          </select>
        </div>
      `;
    });

    html += `</div></div>`;

    container.innerHTML = html;

    loadUserR32Selections();
    setupUserR32Listeners();
    renderNextRoundsUser();
    if (knockoutLocked) disableKnockoutInputs();
  });
}

function setupUserR32Listeners() {

  const uid = localStorage.getItem("uid");
  if (!uid) return;

  document.querySelectorAll("[id^='user_r32_']").forEach(select => {

    select.addEventListener("change", () => {

      const matchNo = select.id.split("_")[2];
      const value = select.value;

      if (!value) return;

      database.ref(`userBracket/${uid}/r32/${matchNo}`).set(value);
    });

  });
}

function loadUserR32Selections() {

  const uid = localStorage.getItem("uid");
  if (!uid) return;

  database.ref(`userBracket/${uid}/r32`).once("value")
    .then(snap => {

      if (!snap.exists()) return;

      const data = snap.val();

      Object.keys(data).forEach(matchNo => {

        const select = document.getElementById(`user_r32_${matchNo}`);
        if (select) select.value = data[matchNo];

      });

    });
}

function renderNextRoundsUser() {

  const uid = localStorage.getItem("uid");
  if (!uid) return;

  const container = document.getElementById("knockoutContainer");

  // ================= R32 → R16 =================
  database.ref(`userBracket/${uid}/r32`).on("value", snap => {

    const r32 = snap.val() || {};

    let r16Map = {
      89: [73, 75],
      90: [74, 77],
      91: [76, 78],
      92: [79, 80],
      93: [83, 84],
      94: [81, 82],
      95: [86, 88],
      96: [85, 87]
    };

    let r16HTML = `
      <div style="margin-top:30px;">
        <h3>Round of 16</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:15px;">
    `;

    Object.keys(r16Map).forEach(matchNo => {

      const [a, b] = r16Map[matchNo];
      const teamA = r32[a];
      const teamB = r32[b];

      if (teamA && teamB) {
        r16HTML += `
          <div class="admin-box">
            <strong>Match ${matchNo}</strong><br><br>
            ${teamA} vs ${teamB}<br><br>

            <select class="knockout-select" id="user_r16_${matchNo}">
              <option value="">Select Winner</option>
              <option value="${teamA}">${teamA}</option>
              <option value="${teamB}">${teamB}</option>
            </select>
          </div>
        `;
      }

    });

    r16HTML += `</div></div>`;

    setSection("r16Section", r16HTML, container);

if (knockoutLocked) disableKnockoutInputs();

    setupNextRoundSave("r16");
    loadNextRoundSelections("r16");

    renderQF();
  });

  // ================= R16 → QF =================
  function renderQF() {

    database.ref(`userBracket/${uid}/r16`).on("value", snap => {

      const r16 = snap.val() || {};

      let qfMap = {
        97: [89, 90],
        98: [93, 94],
        99: [91, 92],
        100: [95, 96]
      };

      let html = `
        <div style="margin-top:30px;">
          <h3>Quarter Finals</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:15px;">
      `;

      Object.keys(qfMap).forEach(matchNo => {

        const [a, b] = qfMap[matchNo];
        const teamA = r16[a];
        const teamB = r16[b];

        if (teamA && teamB) {
          html += `
            <div class="admin-box">
              <strong>Match ${matchNo}</strong><br><br>
              ${teamA} vs ${teamB}<br><br>

              <select class="knockout-select" id="user_qf_${matchNo}">
                <option value="">Select Winner</option>
                <option value="${teamA}">${teamA}</option>
                <option value="${teamB}">${teamB}</option>
              </select>
            </div>
          `;
        }

      });

      html += `</div></div>`;

      setSection("qfSection", html, container);

if (knockoutLocked) disableKnockoutInputs();

      setupNextRoundSave("qf");
      loadNextRoundSelections("qf");

      renderSF();
    });
  }

  // ================= QF → SF =================
  function renderSF() {

    database.ref(`userBracket/${uid}/qf`).on("value", snap => {

      const qf = snap.val() || {};

      let sfMap = {
        101: [97, 98],
        102: [99, 100]
      };

      let html = `
        <div style="margin-top:30px;">
          <h3>Semi Finals</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:15px;">
      `;

      Object.keys(sfMap).forEach(matchNo => {

        const [a, b] = sfMap[matchNo];
        const teamA = qf[a];
        const teamB = qf[b];

        if (teamA && teamB) {
          html += `
            <div class="admin-box">
              <strong>Match ${matchNo}</strong><br><br>
              ${teamA} vs ${teamB}<br><br>

              <select class="knockout-select" id="user_sf_${matchNo}">
                <option value="">Select Winner</option>
                <option value="${teamA}">${teamA}</option>
                <option value="${teamB}">${teamB}</option>
              </select>
            </div>
          `;
        }

      });

      html += `</div></div>`;

      setSection("sfSection", html, container);

if (knockoutLocked) disableKnockoutInputs();

      setupNextRoundSave("sf");
      loadNextRoundSelections("sf");

      renderFinalAndThird();
    });
  }

  // ================= SF → FINAL + 3RD =================
  function renderFinalAndThird() {

  database.ref(`userBracket/${uid}/sf`).on("value", snap => {

    const sf = snap.val() || {};

    if (!sf[101] || !sf[102]) return;

    database.ref(`userBracket/${uid}/qf`).once("value").then(qfSnap => {

      const qf = qfSnap.val() || {};

      const finalA = sf[101];
      const finalB = sf[102];

      const loser101 = getLoser(101, sf, qf);
      const loser102 = getLoser(102, sf, qf);

      if (!loser101 || !loser102) return;

      let html = `
        <div style="margin-top:30px;">

          <h3>3rd Place (Match 103)</h3>
          ${loser101} vs ${loser102}<br><br>
          <select class="knockout-select" id="user_final_103">
            <option value="">Select Winner</option>
            <option value="${loser101}">${loser101}</option>
            <option value="${loser102}">${loser102}</option>
          </select>

          <br><br>

          <h3>Final (Match 104)</h3>
          ${finalA} vs ${finalB}<br><br>
          <select class="knockout-select" id="user_final_104">
            <option value="">Select Winner</option>
            <option value="${finalA}">${finalA}</option>
            <option value="${finalB}">${finalB}</option>
          </select>

        </div>
      `;

      setSection("finalSection", html, container);

if (knockoutLocked) disableKnockoutInputs();

      setupNextRoundSave("final");
      loadNextRoundSelections("final");

    });
  });
}

  // ================= HELPERS =================
  function getLoser(matchNo, sfWinners, qfData) {

  const mapping = {
    101: [97, 98],
    102: [99, 100]
  };

  const [a, b] = mapping[matchNo];

  const teamA = qfData[a];
  const teamB = qfData[b];

  const winner = sfWinners[matchNo];

  if (!teamA || !teamB || !winner) return "";

  return winner === teamA ? teamB : teamA;
}

  function setSection(id, html, parent) {
    let section = document.getElementById(id);

    if (!section) {
      section = document.createElement("div");
      section.id = id;
      parent.appendChild(section);
    }

    section.innerHTML = html;
  }
}

function setupNextRoundSave(round) {

  const uid = localStorage.getItem("uid");
  if (!uid) return;

  document.querySelectorAll(`[id^='user_${round}_']`).forEach(select => {

    select.addEventListener("change", () => {

      const matchNo = select.id.split("_")[2];
      const value = select.value;

      if (!value) return;

      database.ref(`userBracket/${uid}/${round}/${matchNo}`).set(value);
    });

  });

}

function loadNextRoundSelections(round) {

  const uid = localStorage.getItem("uid");
  if (!uid) return;

  database.ref(`userBracket/${uid}/${round}`).once("value")
    .then(snap => {

      if (!snap.exists()) return;

      const data = snap.val();

      Object.keys(data).forEach(matchNo => {

        const select = document.getElementById(`user_${round}_${matchNo}`);
        if (select) select.value = data[matchNo];

      });

    });

}

function renderR16User(uid) {

  const container = document.getElementById("r16Container");
  const message = document.getElementById("r16Message");

  if (!container || !message) return;

  database.ref("bracket/r32Winners/" + uid)
    .on("value", snap => {

      const winners = snap.val() || {};

      if (Object.keys(winners).length < 16) {
        container.innerHTML = "";
        message.innerText = "Complete all R32 selections";
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

      let html = `<div class="grid">`;

      mapping.forEach(match => {

        const teamA = winners[match.a];
        const teamB = winners[match.b];

        html += `
          <div class="match-card">
            <strong>Match ${match.no}</strong><br><br>

            ${teamA} vs ${teamB}

            <br><br>

            <select onchange="saveR16Winner('${uid}', '${match.no}', this.value)">
              <option value="">Select Winner</option>
              <option value="${teamA}">${teamA}</option>
              <option value="${teamB}">${teamB}</option>
            </select>
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;

      loadSavedR16User(uid);
    });
}

function saveR16Winner(uid, matchNo, winner) {
  if (!winner) return;

  database.ref(`bracket/r16Winners/${uid}/${matchNo}`)
    .set(winner);
}

function loadSavedR16User(uid) {

  database.ref("bracket/r16Winners/" + uid)
    .once("value")
    .then(snap => {

      if (!snap.exists()) return;

      const data = snap.val();

      Object.keys(data).forEach(matchNo => {

        const select = document.querySelector(
          `select[onchange="saveR16Winner('${uid}', '${matchNo}', this.value)"]`
        );

        if (select) {
          select.value = data[matchNo];
        }
      });

    });
}

function renderQFUser(uid) {

  const container = document.getElementById("qfContainer");
  const message = document.getElementById("qfMessage");

  database.ref("bracket/r16Winners/" + uid)
    .on("value", snap => {

      const r16 = snap.val() || {};

      const required = [89,90,91,92,93,94,95,96];

      if (required.some(m => !r16[m])) {
        container.innerHTML = "";
        message.innerText = "Complete R16 first";
        return;
      }

      const mapping = [
        { no: 97, a: 89, b: 90 },
        { no: 98, a: 93, b: 94 },
        { no: 99, a: 91, b: 92 },
        { no: 100, a: 95, b: 96 }
      ];

      let html = `<div class="grid">`;

      mapping.forEach(match => {

        const teamA = r16[match.a];
        const teamB = r16[match.b];

        html += `
          <div class="match-card">
            Match ${match.no}<br><br>
            ${teamA} vs ${teamB}<br><br>

            <select onchange="saveQFWinner('${uid}', '${match.no}', this.value)">
              <option value="">Select Winner</option>
              <option value="${teamA}">${teamA}</option>
              <option value="${teamB}">${teamB}</option>
            </select>
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;

      loadSavedQFUser(uid);
    });
}

function saveQFWinner(uid, matchNo, winner) {
  database.ref(`bracket/qfWinners/${uid}/${matchNo}`).set(winner);
}

function saveSFWinner(uid, matchNo, winner, teamA, teamB) {

  const loser = winner === teamA ? teamB : teamA;

  database.ref(`bracket/sfWinners/${uid}/${matchNo}`).set(winner);
  database.ref(`bracket/sfLosers/${uid}/${matchNo}`).set(loser);
}

function renderFinalUser(uid) {

  const container = document.getElementById("finalContainer");

  database.ref("bracket/sfWinners/" + uid)
    .once("value")
    .then(snap => {

      const sf = snap.val() || {};

      if (!sf[101] || !sf[102]) {
        container.innerHTML = "Complete Semi Finals first";
        return;
      }

      database.ref("bracket/sfLosers/" + uid)
        .once("value")
        .then(loserSnap => {

          const losers = loserSnap.val() || {};

          const html = `
            <div>

              <h3>3rd Place</h3>
              ${losers[101]} vs ${losers[102]}
              <select onchange="saveFinal('${uid}', 103, this.value)">
                <option value="">Select</option>
                <option value="${losers[101]}">${losers[101]}</option>
                <option value="${losers[102]}">${losers[102]}</option>
              </select>

              <h3>Final</h3>
              ${sf[101]} vs ${sf[102]}
              <select onchange="saveFinal('${uid}', 104, this.value)">
                <option value="">Select</option>
                <option value="${sf[101]}">${sf[101]}</option>
                <option value="${sf[102]}">${sf[102]}</option>
              </select>

            </div>
          `;

          container.innerHTML = html;

        });
    });
}

function saveFinal(uid, matchNo, winner) {
  database.ref(`bracket/finalWinners/${uid}/${matchNo}`).set(winner);
}

function listenKnockoutLockUser() {

  database.ref("bracketResults/lock/knockout")
    .on("value", snap => {

      knockoutLocked = snap.val() === true;

      if (knockoutLocked) {
        disableKnockoutInputs();
      } else {
        enableKnockoutInputs();
      }

    });

}

function disableKnockoutInputs() {
  setTimeout(() => {
    document.querySelectorAll(".knockout-select").forEach(el => {
      el.disabled = true;
    });
  }, 100);
}

function enableKnockoutInputs() {
  setTimeout(() => {
    document.querySelectorAll(".knockout-select").forEach(el => {
      el.disabled = false;
    });
  }, 100);
}

function formatGroup(group) {

  const map = {
    A: "Group A",
    B: "Group B",
    C: "Group C",
    D: "Group D",
    E: "Group E",
    F: "Group F",
    G: "Group G",
    H: "Group H",
    I: "Group I",
    J: "Group J",
    K: "Group K",
    L: "Group L",

    R32: "Round of 32",
    R16: "Round of 16",
    QF: "Quarter Final",
    SF: "Semi Final",
    FINAL: "Final",
    "3RD": "3rd Place Match"
  };

  return map[group] || group;
}

let currentUserIdForPasswordChange = null;

function showChangePasswordModal(uid) {
  currentUserIdForPasswordChange = uid;
  document.getElementById("changePasswordModal").style.display = "block";
}

function submitNewPassword() {

  const newPass = document.getElementById("newPassword").value.trim();

  if (newPass.length < 4 || newPass.length > 6) {
    alert("Password must be 4 to 6 characters");
    return;
  }

  database.ref("users/" + currentUserIdForPasswordChange).update({
    password: newPass,
    mustChangePassword: false
  }).then(() => {

    alert("Password updated successfully");

    document.getElementById("changePasswordModal").style.display = "none";

    const username = localStorage.getItem("username");
    showUser(username);

  });

}

window.viewPredictions = viewPredictions;
window.savePrediction = savePrediction;
window.closePredictionModal = closePredictionModal;