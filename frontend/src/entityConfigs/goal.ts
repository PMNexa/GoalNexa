import { EntityConfig } from "./types";

export const goalConfig: EntityConfig = {
  resource: "goal",
  path: "/goals",
  scopeField: "org_id",
  methods: ["list", "get", "create", "update", "delete"],
  fields: [
    {
      name: "title",
      label: "Title",
      type: "string",
      required: true,
      showInTable: true,
      sortable: true,
      filterable: false,
    },
    {
      name: "description",
      label: "Description",
      type: "text",
      required: false,
      showInTable: false,
    },
    {
      name: "status",
      label: "Status",
      type: "enum",
      required: true,
      values: ["not_started", "in_progress", "done"],
      badgeColors: {
        not_started: "secondary",
        in_progress: "warning",
        done: "success",
      },
      showInTable: true,
      sortable: true,
      filterable: true,
    },
    {
      name: "target_date",
      label: "Target date",
      type: "date",
      required: false,
      showInTable: true,
      sortable: true,
    },
  ],
  filterFields: ["status"],
  searchFields: ["title"],
};
