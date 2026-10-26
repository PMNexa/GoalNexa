import { FormControl, FormLabel } from "platform-core";

export interface OrgNameStepProps {
  orgName: string;
  /** Locked once a create went through (the org exists). */
  disabled: boolean;
  onChange: (orgName: string) => void;
}

/** The website path's first step: name the organization. */
function OrgNameStep({ orgName, disabled, onChange }: OrgNameStepProps) {
  return (
    <div>
      <h3 className="card-title">Name your organization</h3>
      <p className="text-secondary">Your team, company or household - goals belong to it, and you can invite others later.</p>
      <FormLabel htmlFor="onboarding-org" required>
        Organization name
      </FormLabel>
      <FormControl
        id="onboarding-org"
        autoFocus
        placeholder="e.g. Acme Inc."
        value={orgName}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export default OrgNameStep;
