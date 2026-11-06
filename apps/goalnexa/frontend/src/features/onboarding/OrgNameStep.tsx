import { FormControl, FormLabel, useT } from "platform-core";
import messages from "./messages";

export interface OrgNameStepProps {
  orgName: string;
  /** Locked once a create went through (the org exists). */
  disabled: boolean;
  onChange: (orgName: string) => void;
}

/** The website path's first step: name the organization. */
function OrgNameStep({ orgName, disabled, onChange }: OrgNameStepProps) {
  const t = useT(messages);
  return (
    <div>
      <h3 className="card-title">{t("orgTitle")}</h3>
      <p className="text-secondary">{t("orgHint")}</p>
      <FormLabel htmlFor="onboarding-org" required>
        {t("orgName")}
      </FormLabel>
      <FormControl
        id="onboarding-org"
        autoFocus
        placeholder={t("orgPlaceholder")}
        value={orgName}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export default OrgNameStep;
