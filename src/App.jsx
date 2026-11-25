import React, { useState, useEffect, useMemo } from "react";

const KEYS = {
  users: "splitmate_react_users",
  groups: "splitmate_react_groups",
  expenses: "splitmate_react_expenses",
};

const readData = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
};

const ADMIN_EMAIL = "admin@splitmate.com";
const ADMIN_PASSWORD = "admin123";

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

function calculateBalances(group, expenses) {
  const balances = Object.fromEntries(group.members.map((email) => [email, 0]));

  expenses.forEach((expense) => {
    group.members.forEach((email) => {
      const paid = Number(expense.payments?.[email] || 0);
      const share = Number(expense.shares?.[email] || 0);
      balances[email] = (balances[email] || 0) + paid - share;
    });
  });

  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0.009)
    .map(([email, amount]) => ({ email, amount }));
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < -0.009)
    .map(([email, amount]) => ({ email, amount: -amount }));

  const settlements = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    if (amount > 0.009) {
      settlements.push({
        from: debtors[d].email,
        to: creditors[c].email,
        amount,
      });
    }
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount < 0.01) d++;
    if (creditors[c].amount < 0.01) c++;
  }

  return { balances, settlements };
}

export default function App() {
  const [users, setUsers] = useState(() => readData(KEYS.users));
  const [groups, setGroups] = useState(() => readData(KEYS.groups));
  const [expenses, setExpenses] = useState(() => readData(KEYS.expenses));
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("login");
  const [selectedCode, setSelectedCode] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", password: "", groupName: "", joinCode: "",
    description: "", amount: "",
  });
  const [paymentInputs, setPaymentInputs] = useState({});
  const [shareInputs, setShareInputs] = useState({});

  useEffect(() => localStorage.setItem(KEYS.users, JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem(KEYS.groups, JSON.stringify(groups)), [groups]);
  useEffect(() => localStorage.setItem(KEYS.expenses, JSON.stringify(expenses)), [expenses]);

  const update = (field) => (event) =>
    setForm((old) => ({ ...old, [field]: event.target.value }));

  const myGroups = useMemo(() => {
    if (!currentUser) return [];
    return groups.filter((group) => group.members.includes(currentUser.email));
  }, [groups, currentUser]);

  const selectedGroup = groups.find((group) => group.code === selectedCode);
  const groupExpenses = expenses.filter((expense) => expense.groupCode === selectedCode);
  const balanceData = selectedGroup
    ? calculateBalances(selectedGroup, groupExpenses)
    : { balances: {}, settlements: [] };

  function signup(event) {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    if (!name || !email || !password) return setMessage("Please fill in all fields.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage("Enter a valid email.");
    if (password.length < 6) return setMessage("Password must be at least 6 characters.");
    if (email === ADMIN_EMAIL) return setMessage("This email is reserved for admin.");
    if (users.some((user) => user.email === email)) return setMessage("Email already registered.");
    setUsers((old) => [...old, { name, email, password, role: "user" }]);
    setForm((old) => ({ ...old, name: "", email: "", password: "" }));
    setMessage("Account created. You can now log in.");
    setPage("login");
  }

  function login(event) {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setCurrentUser({ name: "Admin", email, role: "admin" });
      setPage("admin");
      setMessage("");
      return;
    }
    const found = users.find((user) => user.email === email && user.password === password);
    if (!found) return setMessage("Invalid email or password.");
    setCurrentUser(found);
    setPage("dashboard");
    setSelectedCode("");
    setMessage("");
  }

  function createGroup(event) {
    event.preventDefault();
    const name = form.groupName.trim();
    if (!name) return setMessage("Enter a group name.");
    let code;
    do {
      code = "SM" + Math.random().toString(36).slice(2, 8).toUpperCase();
    } while (groups.some((group) => group.code === code));
    setGroups((old) => [...old, {
      name, code, createdBy: currentUser.email, members: [currentUser.email],
    }]);
    setForm((old) => ({ ...old, groupName: "" }));
    setMessage(`Group created. Share this code: ${code}`);
  }

  function joinGroup(event) {
    event.preventDefault();
    const code = form.joinCode.trim().toUpperCase();
    const group = groups.find((item) => item.code === code);
    if (!group) return setMessage("Group code not found in this browser.");
    if (group.members.includes(currentUser.email)) return setMessage("You already joined this group.");
    setGroups((old) => old.map((item) =>
      item.code === code ? { ...item, members: [...item.members, currentUser.email] } : item
    ));
    setForm((old) => ({ ...old, joinCode: "" }));
    setMessage(`You joined ${group.name}.`);
  }

  function addExpense(event) {
    event.preventDefault();
    const description = form.description.trim();
    const amount = Number(form.amount);
    if (!selectedGroup) return setMessage("Select a group first.");
    if (!description || !Number.isFinite(amount) || amount <= 0) {
      return setMessage("Enter a description and a valid amount.");
    }

    const payments = {};
    const shares = {};
    selectedGroup.members.forEach((email) => {
      payments[email] = Math.max(0, Number(paymentInputs[email] || 0));
      shares[email] = Math.max(0, Number(shareInputs[email] || 0));
    });

    const paidTotal = Object.values(payments).reduce((sum, value) => sum + value, 0);
    const shareTotal = Object.values(shares).reduce((sum, value) => sum + value, 0);
    if (Math.abs(paidTotal - amount) > 0.01) {
      return setMessage(`Payment amounts must add up to ${money(amount)}. Currently: ${money(paidTotal)}.`);
    }
    if (Math.abs(shareTotal - amount) > 0.01) {
      return setMessage(`Individual shares must add up to ${money(amount)}. Currently: ${money(shareTotal)}.`);
    }

    setExpenses((old) => [...old, {
      id: `${Date.now()}-${Math.random()}`,
      groupCode: selectedGroup.code,
      description,
      amount,
      payments,
      shares,
      date: new Date().toLocaleDateString(),
    }]);
    setForm((old) => ({ ...old, description: "", amount: "" }));
    setPaymentInputs({});
    setShareInputs({});
    setMessage("Expense and member-wise payments saved successfully.");
  }

  function deleteExpense(id) {
    if (!window.confirm("Delete this expense?")) return;
    setExpenses((old) => old.filter((expense) => expense.id !== id));
  }

  function logout() {
    setCurrentUser(null);
    setSelectedCode("");
    setMessage("");
    setForm({ name: "", email: "", password: "", groupName: "", joinCode: "", description: "", amount: "" });
    setPaymentInputs({});
    setShareInputs({});
    setPage("login");
  }

  function openGroup(code) {
    setSelectedCode(code);
    setPaymentInputs({});
    setShareInputs({});
    setMessage("");
  }

  function userName(email) {
    return users.find((user) => user.email === email)?.name || email;
  }

  const sumInputs = (inputs, members) =>
    members.reduce((sum, email) => sum + Number(inputs[email] || 0), 0);

  return (
    <main className="app-shell">
      <header className="brand">
        <div className="brand-mark">S</div>
        <div>
          <h1>SplitMate</h1>
          <p>Split expenses. Keep friendships simple.</p>
        </div>
      </header>

      {page === "login" && (
        <section className="auth-card">
          <h2>Welcome back</h2>
          <p className="muted">Login with your email address.</p>
          <form onSubmit={login}>
            <label>Email address</label>
            <input type="email" value={form.email} onChange={update("email")} placeholder="you@example.com" required />
            <label>Password</label>
            <input type="password" value={form.password} onChange={update("password")} placeholder="Enter password" required />
            <button className="primary full">Login</button>
          </form>
          <p className="switch-text">New to SplitMate? <button className="text-button" onClick={() => { setMessage(""); setPage("signup"); }}>Create account</button></p>
          {message && <p className="message">{message}</p>}
          <div className="admin-hint"><b>Demo admin:</b> {ADMIN_EMAIL} / {ADMIN_PASSWORD}</div>
        </section>
      )}

      {page === "signup" && (
        <section className="auth-card">
          <h2>Create your account</h2>
          <p className="muted">Use your email to get started.</p>
          <form onSubmit={signup}>
            <label>Full name</label>
            <input value={form.name} onChange={update("name")} placeholder="Your name" required />
            <label>Email address</label>
            <input type="email" value={form.email} onChange={update("email")} placeholder="you@example.com" required />
            <label>Password (minimum 6 characters)</label>
            <input type="password" value={form.password} onChange={update("password")} minLength="6" required />
            <button className="primary full">Create account</button>
          </form>
          <p className="switch-text">Already registered? <button className="text-button" onClick={() => { setMessage(""); setPage("login"); }}>Back to login</button></p>
          {message && <p className="message">{message}</p>}
        </section>
      )}

      {page === "dashboard" && currentUser && (
        <>
          <div className="welcome-row">
            <div><h2>Hello, {currentUser.name} 👋</h2><p className="muted">{currentUser.email}</p></div>
            <button className="secondary" onClick={logout}>Logout</button>
          </div>

          <div className="two-columns">
            <section className="panel">
              <h3>Create a group</h3>
              <p className="muted">Start a new group and get a unique code.</p>
              <form onSubmit={createGroup}>
                <input value={form.groupName} onChange={update("groupName")} placeholder="e.g. College Friends" required />
                <button className="primary">Create group</button>
              </form>
            </section>
            <section className="panel">
              <h3>Join a group</h3>
              <p className="muted">Enter a group code shared with you.</p>
              <form onSubmit={joinGroup}>
                <input value={form.joinCode} onChange={update("joinCode")} placeholder="e.g. SMAB12CD" required />
                <button className="primary">Join group</button>
              </form>
            </section>
          </div>

          {message && <p className="message banner">{message}</p>}

          <section className="panel">
            <div className="section-heading"><h3>My groups</h3><span className="count">{myGroups.length} groups</span></div>
            {myGroups.length === 0 ? <p className="empty">No groups yet. Create or join a group to begin.</p> : (
              <div className="group-grid">
                {myGroups.map((group) => (
                  <button key={group.code} className={`group-tile ${selectedCode === group.code ? "selected" : ""}`} onClick={() => openGroup(group.code)}>
                    <span className="group-icon">👥</span>
                    <b>{group.name}</b>
                    <small>Code: {group.code}</small>
                    <small>{group.members.length} members</small>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedGroup && selectedGroup.members.includes(currentUser.email) && (
            <>
              <section className="panel group-detail">
                <div className="section-heading">
                  <div><h3>{selectedGroup.name}</h3><p className="muted">Group code: <b>{selectedGroup.code}</b></p></div>
                  <span className="count">{selectedGroup.members.length} members</span>
                </div>
                <h4>Members</h4>
                <div className="member-list">
                  {selectedGroup.members.map((email) => <span className="member-chip" key={email}>{userName(email)}</span>)}
                </div>
              </section>

              <section className="panel">
                <h3>Add an expense</h3>
                <p className="muted">Enter how much each person actually paid and each person's share. Both totals must equal the expense total.</p>
                <form onSubmit={addExpense}>
                  <label>Expense description</label>
                  <input value={form.description} onChange={update("description")} placeholder="Dinner, cab, groceries..." required />
                  <label>Total expense amount (₹)</label>
                  <input type="number" min="0.01" step="0.01" value={form.amount} onChange={update("amount")} placeholder="2000" required />

                  <div className="section-heading"><h4>Actual amount paid by each member</h4><span className="count">Total: {money(sumInputs(paymentInputs, selectedGroup.members))}</span></div>
                  {selectedGroup.members.map((email) => (
                    <div className="admin-row" key={`paid-${email}`}>
                      <label>{userName(email)} paid (₹)</label>
                      <input type="number" min="0" step="0.01" placeholder="0" value={paymentInputs[email] ?? ""} onChange={(e) => setPaymentInputs((old) => ({ ...old, [email]: e.target.value }))} />
                    </div>
                  ))}

                  <div className="section-heading"><h4>Each member's share of this expense</h4><span className="count">Total: {money(sumInputs(shareInputs, selectedGroup.members))}</span></div>
                  {selectedGroup.members.map((email) => (
                    <div className="admin-row" key={`share-${email}`}>
                      <label>{userName(email)} share (₹)</label>
                      <input type="number" min="0" step="0.01" placeholder="0" value={shareInputs[email] ?? ""} onChange={(e) => setShareInputs((old) => ({ ...old, [email]: e.target.value }))} />
                    </div>
                  ))}
                  <button className="primary">Save expense</button>
                </form>
                <p className="muted small-note">Example: for a ₹2,000 expense, paid amounts must total ₹2,000 and member shares must also total ₹2,000. Shares can be different for each person.</p>
              </section>

              <section className="panel">
                <div className="section-heading"><h3>Expense history</h3><span className="count">{groupExpenses.length} records</span></div>
                {groupExpenses.length === 0 ? <p className="empty">No expenses added yet.</p> : groupExpenses.map((expense) => (
                  <article className="expense-row" key={expense.id}>
                    <div>
                      <b>{expense.description}</b>
                      <small>{expense.date} · Total {money(expense.amount)}</small>
                      <small>Paid: {selectedGroup.members.filter((email) => Number(expense.payments?.[email] || 0) > 0).map((email) => `${userName(email)} ${money(expense.payments[email])}`).join(" · ") || "Not recorded"}</small>
                      <small>Shares: {selectedGroup.members.map((email) => `${userName(email)} ${money(expense.shares?.[email] || 0)}`).join(" · ")}</small>
                    </div>
                  </article>
                ))}
              </section>

              <section className="panel">
                <div className="section-heading"><h3>Member balance summary</h3><span className="count">All group expenses</span></div>
                {selectedGroup.members.map((email) => (
                  <div className="admin-row" key={email}>
                    <b>{userName(email)}</b>
                    <span>{balanceData.balances[email] >= 0 ? `Gets back ${money(balanceData.balances[email])}` : `Owes ${money(-balanceData.balances[email])}`}</span>
                  </div>
                ))}
                <h4>Who pays whom?</h4>
                {balanceData.settlements.length === 0 ? <p className="empty">Everyone is settled up.</p> : balanceData.settlements.map((item, index) => (
                  <div className="expense-row" key={`${item.from}-${item.to}-${index}`}>
                    <b>{userName(item.from)} pays {userName(item.to)}</b>
                    <strong className="amount">{money(item.amount)}</strong>
                  </div>
                ))}
              </section>
            </>
          )}
        </>
      )}

      {page === "admin" && (
        <>
          <div className="welcome-row">
            <div><h2>Admin Dashboard</h2><p className="muted">Manage demo users, groups and expenses.</p></div>
            <button className="secondary" onClick={logout}>Logout</button>
          </div>
          <section className="panel">
            <h3>Registered users ({users.length})</h3>
            {users.length === 0 ? <p className="empty">No registered users.</p> : users.map((user) => (
              <div className="admin-row" key={user.email}><b>{user.name}</b><span>{user.email}</span></div>
            ))}
          </section>
          <section className="panel">
            <h3>All groups ({groups.length})</h3>
            {groups.length === 0 ? <p className="empty">No groups created.</p> : groups.map((group) => (
              <div className="admin-row" key={group.code}><b>{group.name}</b><span>{group.code} · {group.members.length} members</span></div>
            ))}
          </section>
          <section className="panel">
            <h3>All expenses ({expenses.length})</h3>
            {expenses.length === 0 ? <p className="empty">No expenses added.</p> : expenses.map((expense) => (
              <div className="admin-row" key={expense.id}>
                <div><b>{expense.description}</b><small>{expense.groupCode} · {money(expense.amount)}</small></div>
                <button className="danger small-button" onClick={() => deleteExpense(expense.id)}>Delete</button>
              </div>
            ))}
          </section>
        </>
      )}

      <footer>SplitMate · React & Local Storage</footer>
    </main>
  );
}
