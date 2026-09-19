import { Link } from "react-router-dom";
import { useOrgId } from "../../../hooks/useOrgId";
import { Card } from "../../../components/atoms/card";

/**
 * Minimal org home - just needs to exist and route correctly, linking out to
 * the org's Goals and Members pages.
 */
export function OrgHome() {
  const orgId = useOrgId();

  return (
    <div>
      <h2 className="mb-4">Organization</h2>
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <Card>
            <Card.Body>
              <Card.Title>Goals</Card.Title>
              <p className="text-muted">Track goals for this organization.</p>
              <Link to={`/orgs/${orgId}/admin/goal`} className="btn btn-primary btn-sm">
                View goals
              </Link>
            </Card.Body>
          </Card>
        </div>
        <div className="col-12 col-md-6">
          <Card>
            <Card.Body>
              <Card.Title>Members</Card.Title>
              <p className="text-muted">Manage who has access to this organization.</p>
              <Link to={`/orgs/${orgId}/members`} className="btn btn-primary btn-sm">
                View members
              </Link>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
