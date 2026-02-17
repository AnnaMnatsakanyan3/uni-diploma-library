import { useState } from "react";
import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";
import Navbar from "./Navbar";
import Footer from "./Footer";
import TopBar from "./TopBar";
import AdminPanel from "./AdminPanel";
import DiplomaWorks from "./DiplomaWorks";

import "./library.css";

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("login");

  const logout = () => {
    setUser(null);
    setPage("login");
  };

  return (
  <>
    <TopBar />

    {page === "research" && <div className="container">Research Page</div>}
    {page === "publications" && <div className="container">Publications</div>}

    <Navbar
  user={user}
  goLogin={() => setPage("login")}
  goRegister={() => setPage("register")}
  goAdmin={() => setPage("admin")}
  logout={logout}
  setPage={setPage}
/>

    {/* NOT LOGGED IN */}
    {!user && page === "login" && (
      <Login setUser={setUser} goRegister={() => setPage("register")} />
    )}

    {!user && page === "register" && (
      <Register goLogin={() => setPage("login")} />
    )}

    {/* LOGGED IN */}
    {user && user.role === "admin" && (
      <AdminPanel />
    )}

    {user && user.role !== "admin" && (
      <Dashboard user={user} />
    )}
    {user && page === "diploma" && (
  <DiplomaWorks user={user} />
)}


    <Footer />
  </>
);

}

export default App;
