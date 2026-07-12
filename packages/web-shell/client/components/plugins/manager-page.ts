export interface EmbeddedManagerPage {
  rootLabel: string;
  onRoot: () => void;
  onDetailChange: (open: boolean) => void;
}
