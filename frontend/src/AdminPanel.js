import { useEffect, useState } from "react";
import axios from "axios";

function AdminPanel() {
  const [books, setBooks] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:5000/admin/books")
      .then(res => setBooks(res.data));
  }, []);

  const approve = (id) => {
    axios.post(`http://localhost:5000/admin/approve/${id}`)
      .then(() => {
        setBooks(b => b.map(x =>
          x.id === id ? { ...x, approved:1 } : x
        ));
      });
  };

  return (
    <div style={{padding:40}}>
      <h2>Admin Approval Panel</h2>

      {books.map(b => (
        <div key={b.id} style={{
          border:"1px solid #ddd",
          padding:12,
          marginBottom:10
        }}>
          <b>{b.title}</b> — {b.author} — {b.category}

          {b.approved ? (
            <span style={{color:"green", marginLeft:10}}>
              Approved
            </span>
          ) : (
            <button
              onClick={() => approve(b.id)}
              style={{marginLeft:10}}
            >
              Approve
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default AdminPanel;
