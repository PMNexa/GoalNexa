import type { ReactNode } from "react";
import { Button, Card, CardBody, useT } from "platform-core";
import messages from "./messages";

export interface OrgWaitingProps {
  orgName: string;
  /** The org select, shown in the heading like the setup wizard's. */
  orgPicker?: ReactNode;
  onPersonal: () => void;
  onSetUpAnyway: () => void;
}

/**
 * An organization with no goals, seen by a plain member: its owners and
 * admins set its goals up, so the member isn't handed the setup wizard -
 * personal goals meanwhile, or set it up anyway.
 */
function OrgWaiting({ orgName, orgPicker, onPersonal, onSetUpAnyway }: OrgWaitingProps) {
  const t = useT(messages);
  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-9 col-xl-8">
        <div className="text-center mb-4">
          <h2 className="mb-1 d-flex justify-content-center align-items-center gap-2 flex-wrap">
            {orgPicker ?? orgName}
          </h2>
        </div>
        <Card>
          <CardBody>
            <h3 className="card-title">{t("waitingTitle", { org: orgName })}</h3>
            <p className="text-secondary">{t("waitingText")}</p>
            <div className="d-flex flex-wrap gap-2">
              <Button variant="primary" onClick={onPersonal}>
                {t("waitingPersonal")}
              </Button>
              <Button variant="link" className="text-secondary" onClick={onSetUpAnyway}>
                {t("waitingAnyway")}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default OrgWaiting;
