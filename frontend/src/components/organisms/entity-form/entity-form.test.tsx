import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityForm } from "./entity-form";
import { goalConfig } from "../../../entityConfigs/goal";

describe("EntityForm", () => {
  it("shows a validation error when a required field is left empty", async () => {
    const onSubmit = vi.fn();
    render(<EntityForm config={goalConfig} lockedValues={{ org_id: "org-1" }} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
