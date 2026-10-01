const ESC = 0x1B;
const GS = 0x1D;

let printerCharacteristic = null;
let printerDevice = null;

// Helper to broadcast status changes to React components
function dispatchStatus() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("printer-status-changed", {
            detail: {
                connected: isPrinterConnected(),
                name: getPrinterName()
            }
        }));
    }
}

// ── CONNECT PRINTER ──────────────────────────────────────────
export async function connectPrinter() {
    try {
        if (!navigator.bluetooth) {
            throw new Error("Web Bluetooth is not supported in this browser or context.");
        }

        const device = await navigator.bluetooth.requestDevice({
            filters: [
                { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
                { namePrefix: 'HOP' },
                { namePrefix: 'POS' },
                { namePrefix: 'Printer' },
            ],
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
        });

        printerDevice = device;
        sessionStorage.setItem("printerName", device.name || "Printer");

        device.addEventListener('gattserverdisconnected', () => {
            printerCharacteristic = null;
            console.log("Printer disconnected");
            dispatchStatus();
            autoReconnect();
        });

        printerCharacteristic = await getCharacteristic(device);
        dispatchStatus();
        return printerCharacteristic;

    } catch (err) {
        console.error("Bluetooth connection failed:", err);
        dispatchStatus();
        throw err;
    }
}

// ── GET CHARACTERISTIC ───────────────────────────────────────
async function getCharacteristic(device) {
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(
        '000018f0-0000-1000-8000-00805f9b34fb'
    );
    const characteristic = await service.getCharacteristic(
        '00002af1-0000-1000-8000-00805f9b34fb'
    );
    return characteristic;
}

// ── AUTO RECONNECT ───────────────────────────────────────────
async function autoReconnect() {
    if (!printerDevice) return;
    try {
        console.log("Reconnecting to printer...");
        await new Promise(r => setTimeout(r, 1000));
        printerCharacteristic = await getCharacteristic(printerDevice);
        console.log("Printer reconnected!");
        dispatchStatus();
    } catch (err) {
        console.log("Auto reconnect failed:", err);
        dispatchStatus();
        setTimeout(autoReconnect, 3000);
    }
}

// ── RECONNECT PRINTER ────────────────────────────────────────
export async function reconnectPrinter() {
    try {
        if (!navigator.bluetooth) return false;

        const devices = await navigator.bluetooth.getDevices();
        if (devices.length === 0) return false;

        const device = devices[0];
        printerDevice = device;

        device.addEventListener('gattserverdisconnected', () => {
            printerCharacteristic = null;
            dispatchStatus();
            autoReconnect();
        });

        printerCharacteristic = await getCharacteristic(device);
        sessionStorage.setItem("printerName", device.name || "Printer");
        console.log("✅ Printer auto reconnected!");
        dispatchStatus();
        return true;
    } catch (err) {
        console.log("Auto reconnect failed:", err);
        dispatchStatus();
        return false;
    }
}

// ── CHECK IF CONNECTED ───────────────────────────────────────
export function isPrinterConnected() {
    return printerCharacteristic !== null &&
        printerDevice != null &&
        printerDevice.gatt != null &&
        printerDevice.gatt.connected === true;
}

// ── GET PRINTER NAME ─────────────────────────────────────────
export function getPrinterName() {
    return sessionStorage.getItem("printerName") || null;
}

// ── DISCONNECT PRINTER ───────────────────────────────────────
export function disconnectPrinter() {
    if (printerDevice != null &&
        printerDevice.gatt != null &&
        printerDevice.gatt.connected) {
        printerDevice.gatt.disconnect();
    }
    printerCharacteristic = null;
    printerDevice = null;
    sessionStorage.removeItem("printerName");
    dispatchStatus();
}

// ── PRINT RAW DATA ───────────────────────────────────────────
async function printData(data) {
    if (!isPrinterConnected()) {
        await connectPrinter();
    }
    const chunkSize = 512;
    for (let i = 0; i < data.length; i += chunkSize) {
        await printerCharacteristic.writeValue(data.slice(i, i + chunkSize));
        await new Promise(r => setTimeout(r, 50));
    }
}

// ── CREATE RECEIPT DATA ──────────────────────────────────────
export function createReceiptData(bill) {
    const encoder = new TextEncoder();
    const lines = [];

    lines.push(new Uint8Array([ESC, 0x40]));
    lines.push(new Uint8Array([ESC, 0x61, 0x01]));
    lines.push(new Uint8Array([ESC, 0x21, 0x30]));
    lines.push(encoder.encode("GANGADHAR PROVISION STORE\n"));
    lines.push(new Uint8Array([ESC, 0x21, 0x00]));
    lines.push(encoder.encode("1, Ravikunj Flat, Arunodaya Soc.\n"));
    lines.push(encoder.encode("B.M.C. Gas Supply Rd, Alkapuri\n"));
    lines.push(encoder.encode("Vadodara - 390007\n"));
    lines.push(encoder.encode("Mobile: 95860 52965\n"));
    lines.push(encoder.encode("GSTIN: 24ADHPP8981D1Z9\n"));
    lines.push(encoder.encode("--------------------------------\n"));
    lines.push(new Uint8Array([ESC, 0x61, 0x00]));
    lines.push(encoder.encode(`Bill No : #${bill.bid}\n`));
    lines.push(encoder.encode(`Date    : ${new Date(bill.created_at).toLocaleDateString("en-IN")}\n`));
    lines.push(encoder.encode(`Customer: ${bill.cname}\n`));
    lines.push(encoder.encode(`Phone   : ${bill.phone || "-"}\n`));
    lines.push(encoder.encode(`Payment : ${bill.paymentType}\n`));
    lines.push(encoder.encode("--------------------------------\n"));
    lines.push(new Uint8Array([ESC, 0x21, 0x08]));
    lines.push(encoder.encode("Item            Qty    Amount\n"));
    lines.push(new Uint8Array([ESC, 0x21, 0x00]));
    lines.push(encoder.encode("--------------------------------\n"));

    bill.items.forEach(item => {
        const name = item.product_name.substring(0, 14).padEnd(14);
        const qty = String(item.quantity).padStart(3);
        const amount = `Rs.${item.subtotal.toFixed(2)}`.padStart(9);
        lines.push(encoder.encode(`${name} ${qty} ${amount}\n`));
    });

    lines.push(encoder.encode("--------------------------------\n"));
    lines.push(new Uint8Array([ESC, 0x21, 0x08]));
    lines.push(encoder.encode(
        `TOTAL: Rs.${parseFloat(bill.total_amount).toFixed(2)}\n`
    ));
    lines.push(encoder.encode("--------------------------------\n"));

    lines.push(new Uint8Array([ESC, 0x21, 0x08])); // Bold
    lines.push(encoder.encode("Composition Taxable Person,\n"));
    lines.push(encoder.encode("Not Eligible To Collect Tax On Supplies\n"));
    lines.push(new Uint8Array([ESC, 0x21, 0x00])); // Normal

    lines.push(new Uint8Array([ESC, 0x61, 0x01]));
    lines.push(encoder.encode("Thank You! Visit Again\n"));
    lines.push(new Uint8Array([ESC, 0x64, 0x05]));
    lines.push(new Uint8Array([GS, 0x56, 0x41, 0x10]));

    const totalLength = lines.reduce((sum, l) => sum + l.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    lines.forEach(l => {
        result.set(l, offset);
        offset += l.length;
    });
    return result;
}

// ── CREATE MONTHLY STATEMENT RECEIPT DATA ──────────────────
export function createMonthlyStatementReceiptData(statement) {
    const encoder = new TextEncoder();
    const lines = [];

    // Initialize printer
    lines.push(new Uint8Array([ESC, 0x40]));

    // Justify center
    lines.push(new Uint8Array([ESC, 0x61, 0x01]));

    // Double size
    lines.push(new Uint8Array([ESC, 0x21, 0x30]));
    lines.push(encoder.encode("GANGADHAR PROVISION STORE\n"));

    // Normal size
    lines.push(new Uint8Array([ESC, 0x21, 0x00]));
    lines.push(encoder.encode("1, Ravikunj Flat, Arunodaya Soc.\n"));
    lines.push(encoder.encode("B.M.C. Gas Supply Rd, Alkapuri\n"));
    lines.push(encoder.encode("Vadodara - 390007\n"));
    lines.push(encoder.encode("Mobile: 95860 52965\n"));
    lines.push(encoder.encode("GSTIN: 24ADHPP9881D1Z9\n"));
    lines.push(encoder.encode("--------------------------------\n"));

    // Title
    lines.push(new Uint8Array([ESC, 0x21, 0x08])); // Bold
    lines.push(encoder.encode("MONTHLY STATEMENT\n"));
    lines.push(new Uint8Array([ESC, 0x21, 0x00])); // Normal

    lines.push(new Uint8Array([ESC, 0x61, 0x00])); // Justify left
    lines.push(encoder.encode(`Month   : ${statement.label}\n`));
    lines.push(encoder.encode(`Customer: ${statement.cname}\n`));
    lines.push(encoder.encode(`Phone   : ${statement.phone || "-"}\n`));
    lines.push(encoder.encode("--------------------------------\n"));

    lines.push(new Uint8Array([ESC, 0x21, 0x08])); // Bold header
    lines.push(encoder.encode("Item            Qty    Amount\n"));
    lines.push(new Uint8Array([ESC, 0x21, 0x00]));
    lines.push(encoder.encode("--------------------------------\n"));

    statement.bills.forEach(bill => {
        // Print bill header line
        lines.push(new Uint8Array([ESC, 0x21, 0x08])); // Bold
        const dateStr = new Date(bill.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        lines.push(encoder.encode(`-- Bill #${bill.bid} (${dateStr}) --\n`));
        lines.push(new Uint8Array([ESC, 0x21, 0x00])); // Normal

        bill.items.forEach(item => {
            const name = item.product_name.substring(0, 14).padEnd(14);
            const qty = String(item.quantity).padStart(3);
            const amount = `Rs.${item.subtotal.toFixed(2)}`.padStart(9);
            lines.push(encoder.encode(`${name} ${qty} ${amount}\n`));
        });

        // Print bill subtotal
        const subtotalStr = `Rs.${bill.total_amount.toFixed(2)}`;
        lines.push(encoder.encode(`Subtotal: ${subtotalStr.padStart(22)}\n`));
        lines.push(encoder.encode(".-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-\n"));
    });

    lines.push(encoder.encode("--------------------------------\n"));

    lines.push(new Uint8Array([ESC, 0x61, 0x01])); // Centered
    lines.push(new Uint8Array([ESC, 0x21, 0x18])); // Double height bold
    lines.push(encoder.encode(`TOTAL: Rs.${parseFloat(statement.grand_total).toFixed(2)}\n`));

    lines.push(new Uint8Array([ESC, 0x21, 0x00])); // Normal
    lines.push(encoder.encode("--------------------------------\n"));

    lines.push(new Uint8Array([ESC, 0x21, 0x08])); // Bold
    lines.push(encoder.encode("Composition Taxable Person,\n"));
    lines.push(encoder.encode("Not Eligible To Collect Tax On Supplies\n"));
    lines.push(new Uint8Array([ESC, 0x21, 0x00])); // Normal

    lines.push(new Uint8Array([ESC, 0x61, 0x01]));
    lines.push(encoder.encode("Thank You! Visit Again\n"));
    lines.push(new Uint8Array([ESC, 0x64, 0x05])); // Feed lines
    lines.push(new Uint8Array([GS, 0x56, 0x41, 0x10])); // Cut

    const totalLength = lines.reduce((sum, l) => sum + l.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    lines.forEach(l => {
        result.set(l, offset);
        offset += l.length;
    });
    return result;
}

// ── PRINT BILL ───────────────────────────────────────────────
export async function printBill(bill) {
    try {
        const data = createReceiptData(bill);
        await printData(data);
        return { success: true };
    } catch (err) {
        console.error("Print failed:", err);
        throw err;
    }
}

// ── PRINT MONTHLY STATEMENT ────────────────────────────────
export async function printMonthlyStatement(statement) {
    try {
        const data = createMonthlyStatementReceiptData(statement);
        await printData(data);
        return { success: true };
    } catch (err) {
        console.error("Print failed:", err);
        throw err;
    }
}