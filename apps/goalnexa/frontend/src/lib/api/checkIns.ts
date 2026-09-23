export interface CheckIn {
  id: string;
  metric: string;
  /** DRF `DecimalField` serializes as a string, not a JSON number - see `Metric`'s own field of the same kind for why. The metric's new reading as of this check-in, not a delta - see the backend `CheckIn` model's own docstring. */
  value: string;
  note: string;
  /** When the reading was taken (ISO timestamp) - user-set, defaults to creation time when left blank. */
  checked_in_at: string;
}
