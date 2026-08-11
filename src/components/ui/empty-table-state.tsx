type EmptyTableStateProps = {
  colSpan: number;
  message: string;
};

export function EmptyTableState({ colSpan, message }: EmptyTableStateProps) {
  return (
    <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </td>
  );
}
