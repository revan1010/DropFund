import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Set the PDF.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Interface for donation entries extracted from file uploads or CSV
 */
export interface DonationEntry {
  phoneNumber: string;
  walletAddress: string;
  amount: string;
}

/**
 * Parse a PDF file containing donation entries
 * Expected format: Phone Number | Wallet Address | Amount
 */
export const parsePdfFile = async (file: File): Promise<DonationEntry[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfData = new Uint8Array(arrayBuffer);
    
    // Load the PDF document using PDF.js
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdfDocument = await loadingTask.promise;
    
    // Array to store all donation entries
    const entries: DonationEntry[] = [];
    
    // Process each page in the PDF
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      
      // Extract the text from the page
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      console.log("Extracted text from page:", pageText);
      
      // Try different splitting methods for the text
      let lines: string[] = [];
      
      // First, try to extract patterns that match our expected format
      const donationPatterns = pageText.match(/\+\d+\s*\|\s*0x[a-fA-F0-9]{40}\s*\|\s*\d*\.?\d+/g);
      if (donationPatterns && donationPatterns.length > 0) {
        console.log("Found donation patterns:", donationPatterns);
        lines = donationPatterns;
      } else {
        // Try to extract any potential donation entries by looking for wallet addresses
        const walletAddresses = pageText.match(/0x[a-fA-F0-9]{40}/g) || [];
        console.log("Found wallet addresses:", walletAddresses);
        
        // For each wallet address, try to extract the donation entry
        walletAddresses.forEach(address => {
          const index = pageText.indexOf(address);
          if (index > 0) {
            // Look for the beginning of this entry (likely a phone number)
            const beforeAddr = pageText.substring(Math.max(0, index - 50), index).trim();
            const phoneMatch = beforeAddr.match(/\+\d+/);
            
            // Look for the end of this entry (likely an amount)
            const afterAddr = pageText.substring(index + address.length, index + address.length + 50).trim();
            const amountMatch = afterAddr.match(/\d*\.?\d+/);
            
            if (phoneMatch && amountMatch) {
              const phone = phoneMatch[0];
              const amount = amountMatch[0];
              const reconstructedLine = `${phone} | ${address} | ${amount}`;
              console.log("Reconstructed line:", reconstructedLine);
              lines.push(reconstructedLine);
            }
          }
        });
        
        // If we still couldn't find lines, fall back to original methods
        if (lines.length === 0) {
          // Try split by newline first
          const newlineMatches = pageText.split(/\n|\r\n|\r/);
          if (newlineMatches.length > 1) {
            lines = newlineMatches;
          } else {
            // Try to split by pipe patterns
            const pipeMatches = pageText.match(/([^|]+\|[^|]+\|[^|]+)/g);
            if (pipeMatches && pipeMatches.length > 0) {
              lines = pipeMatches;
            } else {
              // Fallback to splitting by large whitespace
              lines = pageText.split(/\s{4,}/);
            }
          }
        }
      }
      
      console.log("Parsed lines:", lines);
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        console.log("Processing line:", line);
        
        // Try to match the expected format (Phone Number | Wallet Address | Amount)
        // Look for pipe separator first
        let parts: string[] = [];
        
        if (line.includes('|')) {
          parts = line.split('|').map(part => part.trim());
          console.log("Split by pipe:", parts);
        } else {
          // Try to find Ethereum address pattern (0x...) and parse around it
          const ethAddressMatch = line.match(/0x[a-fA-F0-9]{40}/);
          if (ethAddressMatch) {
            const ethAddress = ethAddressMatch[0];
            const ethAddrIndex = line.indexOf(ethAddress);
            
            // Assuming phone is before the address and amount is after
            const phonePart = line.substring(0, ethAddrIndex).trim();
            const amountPart = line.substring(ethAddrIndex + ethAddress.length).trim();
            
            parts = [phonePart, ethAddress, amountPart];
            console.log("Split by ETH address:", parts);
          }
        }
        
        if (parts.length >= 3) {
          const phoneNumber = parts[0];
          const walletAddress = parts[1];
          
          // Improved amount parsing 
          let amount = parts[2].trim();
          
          // Handle decimal numbers better by first checking if it's a valid number
          if (/^\d*\.?\d+$/.test(amount)) {
            // Valid number format, leave as is
          } else {
            // Extract just the numbers and decimal point
            const numberMatch = amount.match(/(\d*\.?\d+)/);
            if (numberMatch) {
              amount = numberMatch[0];
            } else if (amount === '') {
              amount = "0";
            }
          }
          
          console.log("Parsed amount:", amount);
          
          // Validate wallet address (basic check)
          if (walletAddress.startsWith('0x') && walletAddress.length === 42) {
            entries.push({
              phoneNumber,
              walletAddress,
              amount
            });
            console.log("Found valid entry:", { phoneNumber, walletAddress, amount });
          } else {
            console.log("Invalid wallet address format:", walletAddress);
          }
        } else {
          console.log("Not enough parts in line:", parts);
        }
      }
    }
    
    console.log("Total entries found:", entries.length);
    
    return entries;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse the PDF file. Please ensure it has the correct format.');
  }
};

// Export parsePdfFile as parsePDF to maintain compatibility with FileUpload component
export const parsePDF = parsePdfFile;

/**
 * Generate a sample PDF for testing
 * This is useful for users who want to try the bulk donation feature
 */
export const generateSamplePDF = async (): Promise<Uint8Array> => {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add a page
    const page = pdfDoc.addPage([600, 400]);
    
    // Get a font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Draw title
    page.drawText('Sample Donation List', {
      x: 50,
      y: 350,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });
    
    // Draw header
    page.drawText('Phone Number | Wallet Address | Amount', {
      x: 50,
      y: 320,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    
    // Draw sample data with all three required fields
    const sampleData = [
      '+1234567890 | 0x1234567890123456789012345678901234567890 | 0.1',
      '+0987654321 | 0xabcdef1234567890abcdef1234567890abcdef12 | 0.2',
      '+1122334455 | 0x3333333333333333333333333333333333333333 | 0.05',
      '+2233445566 | 0x4444444444444444444444444444444444444444 | 0.075',
      '+3344556677 | 0x5555555555555555555555555555555555555555 | 0.3'
    ];
    
    sampleData.forEach((line, index) => {
      page.drawText(line, {
        x: 50,
        y: 290 - (index * 20),
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    });
    
    // Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();
    
    // Return the Uint8Array
    return pdfBytes;
  } catch (error) {
    console.error('Error generating sample PDF:', error);
    throw new Error('Failed to generate sample PDF');
  }
};

/**
 * Basic function to parse PDF content (placeholder for actual implementation)
 * @param pdfText The extracted text from a PDF
 * @returns Array of donation entries
 */
export const parsePdfContent = (pdfText: string): DonationEntry[] => {
  // This is a simple placeholder implementation
  // In a real application, this would use regex or a more sophisticated parsing approach
  
  const entries: DonationEntry[] = [];
  
  // Split by lines and look for patterns that might be phone and wallet
  const lines = pdfText.split('\n');
  
  lines.forEach(line => {
    // Very basic parsing example
    // Would need to be customized based on actual PDF structure
    const parts = line.trim().split(/\s+/);
    
    // Look for phone number-like pattern
    const phoneMatch = parts.find(part => /^\+?[0-9]{10,15}$/.test(part));
    
    // Look for Ethereum address-like pattern
    const walletMatch = parts.find(part => /^0x[a-fA-F0-9]{40}$/.test(part));
    
    // Look for amount-like pattern
    const amountMatch = parts.find(part => /^[0-9]+(\.[0-9]{1,6})?$/.test(part));
    
    if (phoneMatch && amountMatch) {
      entries.push({
        phoneNumber: phoneMatch,
        walletAddress: walletMatch || '0x0000000000000000000000000000000000000000',
        amount: amountMatch
      });
    }
  });
  
  return entries;
};

/**
 * Simple CSV parser for donation entries
 * @param csvContent The CSV content as string
 * @returns Array of donation entries
 */
export const parseCsvContent = (csvContent: string): DonationEntry[] => {
  const entries: DonationEntry[] = [];
  
  // Split by lines
  const lines = csvContent.split('\n');
  
  // Remove header if present
  if (lines.length > 0 && lines[0].toLowerCase().includes('phone')) {
    lines.shift();
  }
  
  lines.forEach(line => {
    const parts = line.split(',');
    
    if (parts.length >= 2) {
      const phone = parts[0]?.trim();
      const amount = parts[1]?.trim();
      const wallet = parts[2]?.trim() || '0x0000000000000000000000000000000000000000';
      
      // Basic validation
      if (phone && amount && !isNaN(parseFloat(amount))) {
        entries.push({
          phoneNumber: phone,
          amount,
          walletAddress: wallet
        });
      }
    }
  });
  
  return entries;
}; 