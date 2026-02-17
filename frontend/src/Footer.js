import React from "react";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";

function Footer() {
  return (
    <footer className="nuaca-footer">

      <div className="footer-section footer-about">
        <h4>National University of Architecture and Construction of Armenia</h4>
        <p>Students Digital Library Portal</p>
      </div>

      <div className="footer-section footer-contact">
        <h5>Contact</h5>
        <p>105 Teryan St, Yerevan, Armenia</p>
        <p>Phone: +374 10 123456</p>
        <p>Email: info@nuaca.am</p>
      </div>

      <div className="footer-section footer-links">
        <h5>Follow Us</h5>
        <div className="social-icons">
          <a href="https://facebook.com" target="_blank" rel="noreferrer">
            <FaFacebookF />
          </a>
          <a href="https://instagram.com" target="_blank" rel="noreferrer">
            <FaInstagram />
          </a>
          <a href="https://youtube.com" target="_blank" rel="noreferrer">
            <FaYoutube />
          </a>
        </div>
      </div>

    </footer>
  );
}
export default Footer;