import type { WarrantyField } from "@/lib/types";

export function WarrantyTable({
  title,
  items,
  onOpenSource
}: {
  title: string;
  items: WarrantyField[];
  onOpenSource: (item: WarrantyField) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="warranty-block">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>字段</th>
              <th>内容</th>
              <th>备注</th>
              <th>位置</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.field}</td>
                <td>{item.content}</td>
                <td>{item.note}</td>
                <td>
                  <button className="link-button" type="button" onClick={() => onOpenSource(item)}>
                    {item.location || "查看"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
