import axios from "axios";

function Login({ setUser, goRegister }) {
  const login = async (e) => {
    e.preventDefault();
    const form = e.target;

    try {
      const res = await axios.post("http://localhost:5000/login", {
        email: form.email.value,
        password: form.password.value
      });

      setUser(res.data);
    } catch (err) {
      alert("Login failed");
    }
  };

  return (
  <div className="auth-center">
    <div className="auth-card">

      <h2>Login</h2>

      <form onSubmit={login}>
        <input name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <button>Login</button>
      </form>

      <button
        type="button"
        onClick={goRegister}
        style={{ marginTop: 12, background: "#6b7280" }}
      >
        Create account
      </button>

    </div>
  </div>
);
}

export default Login;