import { useState } from "react";
import Inbox from "./Inbox";
import SupportCenter from "./SupportCenter";
import { useTranslation } from "react-i18next";

function CommunicationsPage({ user, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || "inbox");
  const { t } = useTranslation();

  return (
    <div className="container">
      <div className="academics-tabs">
        <button
          className={activeTab === "inbox" ? "acad-tab active" : "acad-tab"}
          onClick={() => setActiveTab("inbox")}
        >
          📬 {t("inbox") || "Inbox"}
        </button>
        {user.role !== "admin" && (
          <button
            className={activeTab === "support" ? "acad-tab active" : "acad-tab"}
            onClick={() => setActiveTab("support")}
          >
            🎧 {t("supportTab")}
          </button>
        )}
      </div>

      <div className="academics-content">
        {activeTab === "inbox" && <Inbox user={user} />}
        {activeTab === "support" && user.role !== "admin" && <SupportCenter user={user} />}
      </div>
    </div>
  );
}

export default CommunicationsPage;
