import { DonationEntry } from '../utils/pdfParser';

interface DonationTableProps {
  entries: DonationEntry[];
  totalAmount: string;
}

const DonationTable = ({ entries, totalAmount }: DonationTableProps) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="donation-table">
      <h2>Donation List ({entries.length} recipients)</h2>
      
      <div className="table-summary">
        <p><strong>Total Amount:</strong> {totalAmount} USDC</p>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Phone Number</th>
              <th>Wallet Address</th>
              <th>Amount (USDC)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{entry.phoneNumber}</td>
                <td className="address">
                  {entry.walletAddress.substring(0, 6)}...
                  {entry.walletAddress.substring(entry.walletAddress.length - 4)}
                </td>
                <td className="amount">{entry.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DonationTable; 