import React, { useState, useRef, ChangeEvent } from 'react';
import { parsePDF, generateSamplePDF, DonationEntry } from '../utils/pdfParser';

interface FileUploadProps {
  onDataParsed: (entries: DonationEntry[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataParsed }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<DonationEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Calculate total amount
  const totalAmount = entries.reduce((sum, entry) => sum + parseFloat(entry.amount), 0).toFixed(2);
  
  // Format wallet address for display
  const formatWalletAddress = (address: string): string => {
    if (address.length <= 12) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setError(null);
    setIsLoading(true);

    try {
      const donations = await parsePDF(selectedFile);
      setEntries(donations);
      onDataParsed(donations);
    } catch (err) {
      setError('Failed to parse PDF. Please ensure it follows the correct format.');
      console.error(err);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSamplePDFGeneration = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const pdfBytes = await generateSamplePDF();
      if (pdfBytes && fileInputRef.current) {
        // Create a file object from the generated PDF bytes
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfFile = new File([pdfBlob], 'sample_donations.pdf', { type: 'application/pdf' });
        
        // Create a DataTransfer to set the file to the file input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(pdfFile);
        fileInputRef.current.files = dataTransfer.files;
        
        setFile(pdfFile);
        
        // Process the sample file
        const donations = await parsePDF(pdfFile);
        setEntries(donations);
        onDataParsed(donations);
      }
    } catch (err) {
      setError('Failed to generate sample PDF');
      console.error(err);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="file-upload">
      <h2>Upload Donation List</h2>
      
      <div className="sample-pdf">
        <p>Upload a PDF with donation data in the following format:</p>
        <p><strong>Phone Number | Wallet Address | Amount</strong></p>
        <p>Example: <code>+1234567890,0x123...abc,100.50</code></p>
        <p className="important-note">
          <strong>Important:</strong> Uploading this list only assigns funds to recipients. 
          Recipients must register their phone numbers themselves in the Claim Portal to access funds.
        </p>
        
        <button 
          className="sample-pdf-button" 
          onClick={handleSamplePDFGeneration}
          disabled={isLoading}
        >
          {isLoading ? 'Generating...' : 'Generate Sample PDF'}
        </button>
      </div>
      
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="file-input"
        id="pdfUpload"
        ref={fileInputRef}
      />
      
      {isLoading ? (
        <div className="loading">Processing file...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : entries.length > 0 ? (
        <div className="entries">
          <h3>Extracted Entries</h3>
          <table>
            <thead>
              <tr>
                <th>Phone Number</th>
                <th>Wallet Address</th>
                <th>Amount (USDC)</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={index}>
                  <td>{entry.phoneNumber}</td>
                  <td>{formatWalletAddress(entry.walletAddress)}</td>
                  <td>{entry.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="total">
            <strong>Total Amount:</strong> {totalAmount} USDC
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FileUpload; 