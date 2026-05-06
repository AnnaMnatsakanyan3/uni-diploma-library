import React from "react";
import { useTranslation } from "react-i18next";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";

function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="nuaca-footer">

      <div className="footer-section footer-about">
        <h4>{t("footerTitle")}</h4>
        <p>{t("footerSubtitle")}</p>
      </div>

      <div className="footer-section footer-contact">
        <h5>{t("contact")}</h5>
        <p>{t("footerAddress")}</p>
        <p>{t("footerPhone1")}</p>
        <p>{t("footerPhone2")}</p>
        <p>{t("footerEmail")}</p>
      </div>

      <div className="footer-section footer-links">
        <h5>{t("followUs")}</h5>
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