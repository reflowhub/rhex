import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import RaffleWinnerEmail from "@/emails/raffle-winner";

// POST /api/admin/raffle/draw — Draw a random winner for a month
export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { month } = body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "month is required in YYYY-MM format" },
        { status: 400 }
      );
    }

    // Check if a winner already exists for this month
    const existingWinner = await adminDb
      .collection("feedbackEntries")
      .where("raffleMonth", "==", month)
      .where("raffleWinner", "==", true)
      .limit(1)
      .get();

    if (!existingWinner.empty) {
      const w = existingWinner.docs[0].data();
      return NextResponse.json(
        {
          error: "Winner already drawn for this month",
          winner: {
            customerName: w.customerName,
            customerEmail: w.customerEmail,
          },
        },
        { status: 400 }
      );
    }

    // Get all eligible entries
    const entries = await adminDb
      .collection("feedbackEntries")
      .where("raffleMonth", "==", month)
      .where("raffleWinner", "==", false)
      .get();

    if (entries.empty) {
      return NextResponse.json(
        { error: "No eligible entries for this month" },
        { status: 400 }
      );
    }

    // Pick a random winner
    const winnerIndex = Math.floor(Math.random() * entries.docs.length);
    const winnerDoc = entries.docs[winnerIndex];
    const winnerData = winnerDoc.data();

    // Mark as winner
    await winnerDoc.ref.update({ raffleWinner: true });

    // Format month for email (e.g. "2026-02" → "February 2026")
    const [year, monthNum] = month.split("-");
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const formattedMonth = `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`;

    // Send winner notification email (non-blocking)
    if (winnerData.customerEmail) {
      sendEmail({
        to: winnerData.customerEmail,
        subject: `You won the rhex ${formattedMonth} raffle!`,
        react: RaffleWinnerEmail({
          customerName: winnerData.customerName ?? "there",
          raffleMonth: formattedMonth,
        }),
      }).catch((err) =>
        console.error("Failed to send raffle winner email:", err)
      );
    }

    return NextResponse.json({
      winner: {
        id: winnerDoc.id,
        customerName: winnerData.customerName,
        customerEmail: winnerData.customerEmail,
        rating: winnerData.rating,
        quoteId: winnerData.quoteId,
      },
      totalEntries: entries.docs.length,
    });
  } catch (error) {
    console.error("Error drawing raffle winner:", error);
    return NextResponse.json(
      { error: "Failed to draw winner" },
      { status: 500 }
    );
  }
}
