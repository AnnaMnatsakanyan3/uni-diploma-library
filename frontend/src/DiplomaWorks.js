import { useEffect, useState } from "react";
import axios from "axios";


function DiplomaWorks({ user }) {
  const [items, setItems] = useState([]);
  const [year, setYear] = useState("");
  const [department, setDepartment] = useState("");



  useEffect(() => {
    axios.get("http://localhost:5000/diploma")
      .then(res => setItems(res.data));
  }, []);


  return (

    <div className="main">
      <h2>Diploma Works Repository</h2>

      {items.map(d => (
        <div key={d.id} className="file-card">

          <h4>{d.title}</h4>

          <p>Student: {d.student}</p>
          <p>Supervisor: {d.supervisor}</p>
          <p>{d.department} — {d.year}</p>

          <button
            onClick={() =>
              window.open(
                `http://localhost:5000/uploads/${d.filename}`,
                "_blank"
              )
            }
          >
            Preview
          </button>

          <a
            href={`http://localhost:5000/uploads/${d.filename}`}
            download
          >
            Download
          </a>
          <input
  placeholder="Filter by year"
  value={year}
  onChange={e => setYear(e.target.value)}
/>

<input
  placeholder="Department"
  value={department}
  onChange={e => setDepartment(e.target.value)}
/>


        </div>
      ))}
    </div>
  );
}

export default DiplomaWorks;