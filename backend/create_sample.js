const fs = require('fs');
const path = require('path');

const textContent = `Introduction to Structural Engineering

Chapter 1: Fundamentals of Structural Analysis

Structural engineering is a sub-discipline of civil engineering in which structural engineers are trained to design the bones and muscles that create the form and shape of man-made structures.

1.1 Types of Loads
Structures must be designed to resist various types of loads:
Dead loads are the weight of the structure itself and any permanent fixtures.
Live loads are temporary loads such as people, furniture, and movable equipment.
Wind loads are forces exerted by wind pressure on the structure.
Seismic loads are forces generated during earthquakes.
Snow loads are the weight of accumulated snow on the structure.

1.2 Structural Elements
The main structural elements include:
Beams are horizontal members that carry loads perpendicular to their length.
Columns are vertical members that carry compressive loads.
Slabs are flat horizontal surfaces that distribute loads to beams.
Foundations are elements that transfer loads from the structure to the ground.
Trusses are triangulated frameworks used for large spans.

1.3 Material Properties
Key material properties in structural engineering:
Compressive strength is the capacity to resist compression.
Tensile strength is the capacity to resist tension.
Modulus of elasticity measures stiffness and is also known as Young Modulus.
Yield strength is the stress at which permanent deformation begins.
Poisson ratio is the ratio of lateral strain to axial strain.

1.4 Equilibrium Conditions
For a structure to be in static equilibrium:
Sum of all horizontal forces must equal zero.
Sum of all vertical forces must equal zero.
Sum of all moments about any point must equal zero.

Chapter 2: Stress and Strain

Stress is defined as force per unit area measured in Pascals or Megapascals.
Normal stress equals Force divided by Area.
Shear stress equals Shear Force divided by Area.
Strain is the deformation per unit length.
Normal strain equals Change in length divided by Original length.
Hooke Law states that stress is proportional to strain within the elastic limit.

Chapter 3: Concrete Design

Reinforced concrete is the most widely used construction material.
It combines concrete which is strong in compression with steel reinforcement which is strong in tension.
The compressive strength of concrete is typically measured at 28 days and ranges from 20 MPa to 60 MPa.
Steel reinforcement typically has a yield strength of 400 MPa or 500 MPa.
The design follows limit state design principles where both ultimate limit state and serviceability limit state must be satisfied.
`;

// Build PDF content
const lines = textContent.split('\n');
let bt = 'BT\n/F1 11 Tf\n50 750 Td\n13 TL\n';
for (const line of lines) {
  const safe = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  bt += `(${safe}) '\n`;
}
bt += 'ET';

const streamBytes = Buffer.from(bt);

let pdf = '';
const offsets = [];

pdf += '%PDF-1.4\n';

offsets.push(Buffer.byteLength(pdf));
pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

offsets.push(Buffer.byteLength(pdf));
pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

offsets.push(Buffer.byteLength(pdf));
pdf += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';

offsets.push(Buffer.byteLength(pdf));
pdf += `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`;
const beforeStream = Buffer.from(pdf);
const afterStream = Buffer.from('\nendstream\nendobj\n');

offsets.push(beforeStream.length + streamBytes.length + afterStream.length);
const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

const xrefStart = beforeStream.length + streamBytes.length + afterStream.length + Buffer.byteLength(obj5);

let trailer = `xref\n0 6\n`;
trailer += `0000000000 65535 f \n`;
// We'll just write a simple PDF without precise xref for pdf-parse
trailer += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

const finalBuf = Buffer.concat([
  beforeStream,
  streamBytes,
  afterStream,
  Buffer.from(obj5),
  Buffer.from(trailer)
]);

const outPath = path.join(__dirname, 'uploads', 'sample_structural.pdf');
fs.writeFileSync(outPath, finalBuf);
console.log('Sample PDF created at:', outPath);
