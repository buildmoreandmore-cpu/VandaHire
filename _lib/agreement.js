// Shared Service Agreement HTML for emails
// Used in: quote email (admin.js), deposit confirmation (stripe.js), auto-charge receipt (cron.js)

export function getAgreementHtml({ deposit, balance, total } = {}) {
  const depStr = deposit > 0 ? `$${deposit.toFixed(2)}` : 'the quoted amount'
  const balStr = balance > 0 ? `$${balance.toFixed(2)}` : 'the quoted amount'

  return `
    <div style="background:#141414;border:1px solid #1e1e1e;border-radius:8px;padding:24px;margin:20px 0;font-size:13px;color:#ccc;line-height:1.7">
      <h3 style="margin:0 0 12px;font-size:16px;color:#ffffff;border-bottom:2px solid #ffffff;padding-bottom:8px">V&A Workforce Staffing Services Agreement</h3>
      <p style="margin:0 0 10px">This Service Agreement ("Agreement") is entered into between <strong>Varist and Associates LLC</strong> ("Company," "we," "us") and the undersigned event organizer ("Client," "you") upon acceptance.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">1. Scope of Services</p>
      <p style="margin:0 0 10px">V&A Workforce will provide temporary staffing personnel ("Workers") for Client's event as described in the accepted quote. V&A Workforce retains sole discretion over worker selection, assignment, and management. Workers are employees or contractors of V&A Workforce, not of Client.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">2. Payment Terms</p>
      <p style="margin:0 0 6px"><strong>Deposit:</strong> A non-refundable deposit of <strong>${depStr}</strong> is due upon acceptance of this Agreement. Staffing will not commence until the deposit is received.</p>
      <p style="margin:0 0 6px"><strong>Balance:</strong> The remaining balance of <strong>${balStr}</strong> is due Net 15 (fifteen calendar days after the event date). By accepting this Agreement, Client <strong>expressly authorizes V&A Workforce to automatically charge the payment method on file</strong> for the balance amount on or after the Net 15 due date without further notice or consent.</p>
      <p style="margin:0 0 10px"><strong>Late Fees:</strong> Unpaid balances will incur a late fee of 2% per week, compounding, up to a maximum of 10% of the outstanding balance.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">3. Card Authorization & Future Charges</p>
      <p style="margin:0 0 10px">By providing payment information and accepting this Agreement, Client authorizes V&A Workforce to: (a) charge the deposit amount immediately; (b) store the payment method securely for future charges; (c) automatically charge the balance amount on or after the Net 15 due date; (d) charge any applicable late fees, penalties, or additional charges incurred under this Agreement. This authorization remains in effect until all obligations under this Agreement are fulfilled.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">4. Non-Dispute & Chargeback Policy</p>
      <p style="margin:0 0 10px">Client agrees <strong>not to initiate any chargebacks, payment disputes, or reversals</strong> with their bank, credit card company, or payment processor for any charges made under this Agreement. If Client files a chargeback or dispute, Client agrees to pay: (a) the full original charge amount; (b) a $50 chargeback administration fee; (c) all costs incurred by V&A Workforce in responding to the dispute, including attorney's fees. Any disputed amount that is reversed shall remain a valid debt owed by Client.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">5. Cancellation & Refund Policy</p>
      <p style="margin:0 0 6px">Client may cancel this Agreement subject to the following refund schedule based on notice provided before the event date:</p>
      <ul style="margin:0 0 6px;padding-left:20px">
        <li>7+ days: 95% refund of deposit (5% processing fee retained)</li>
        <li>3-6 days: 50% refund of deposit</li>
        <li>24-72 hours: 25% refund of deposit</li>
        <li>Less than 24 hours: No refund</li>
      </ul>
      <p style="margin:0 0 10px">Balance payments are non-refundable once services have been rendered.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">6. Limitation of Liability</p>
      <p style="margin:0 0 10px">V&A Workforce's total liability for any claims arising under this Agreement shall not exceed the total amount paid by Client. <strong>In no event shall V&A Workforce be liable for any indirect, incidental, consequential, special, or punitive damages</strong>, including but not limited to lost profits, lost revenue, business interruption, or damage to reputation, regardless of the cause of action or theory of liability.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">7. Indemnification</p>
      <p style="margin:0 0 10px">Client agrees to <strong>indemnify, defend, and hold harmless</strong> V&A Workforce, its officers, directors, employees, agents, and contractors from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorney's fees) arising from or related to: (a) Client's event, venue, or premises; (b) Client's negligence or willful misconduct; (c) any injury to persons or damage to property at the event venue; (d) Client's breach of this Agreement; (e) any third-party claims related to the event.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">8. Venue Safety & Working Conditions</p>
      <p style="margin:0 0 10px">Client is solely responsible for providing a safe working environment for all Workers. V&A Workforce reserves the right to immediately withdraw Workers from any unsafe conditions, and Client shall be responsible for full payment for the scheduled shift. Client shall not require Workers to perform tasks outside the agreed scope of work or that violate any applicable laws or safety regulations.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">9. Non-Solicitation</p>
      <p style="margin:0 0 10px">Client agrees not to directly hire, contract with, or solicit any V&A Workforce Worker for a period of twelve (12) months following any event at which the Worker was placed by V&A Workforce. If Client breaches this provision, Client shall pay a placement fee equal to 25% of the Worker's annualized compensation or $5,000, whichever is greater.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">10. Collection & Enforcement</p>
      <p style="margin:0 0 10px">If Client fails to pay any amount due under this Agreement, V&A Workforce may: (a) assess late fees as described above; (b) report the delinquency to credit bureaus; (c) engage collection agencies, with all collection costs borne by Client; (d) <strong>file a mechanic's lien, judgment lien, or UCC lien</strong> against Client's business assets; (e) pursue legal action in any court of competent jurisdiction. Client agrees to pay all costs of collection, including reasonable <strong>attorney's fees, court costs, and filing fees</strong>.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">11. Governing Law & Jurisdiction</p>
      <p style="margin:0 0 10px">This Agreement shall be governed by and construed in accordance with the laws of the <strong>State of Georgia</strong>. Any disputes arising under this Agreement shall be resolved exclusively in the state or federal courts located in Fulton County, Georgia. Client consents to personal jurisdiction in such courts.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">12. Prevailing Party Attorney's Fees</p>
      <p style="margin:0 0 10px">In any legal action or proceeding arising under this Agreement, the <strong>prevailing party shall be entitled to recover reasonable attorney's fees</strong>, expert witness fees, court costs, and all other costs and expenses incurred.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">13. Force Majeure</p>
      <p style="margin:0 0 10px">Neither party shall be liable for failure to perform obligations due to acts of God, government orders, natural disasters, pandemics, civil unrest, or other circumstances beyond reasonable control. In such events, obligations shall be suspended for the duration of the force majeure event.</p>

      <p style="margin:16px 0 6px;font-weight:bold;color:#ffffff">14. Entire Agreement</p>
      <p style="margin:0 0 10px">This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements. No modification shall be effective unless in writing and signed by both parties. If any provision is found unenforceable, the remaining provisions shall continue in full force.</p>

      <p style="margin:16px 0 0;font-size:11px;color:#999">Varist and Associates LLC &bull; 196 Peachtree St SW, #121, Atlanta, GA 30303 &bull; vandahire.com</p>
    </div>`

}

export function getSignedAgreementFooter({ signerName, signedAt, ip }) {
  const dateStr = signedAt ? new Date(signedAt).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }) : 'N/A'

  return `
    <div style="background:#1a1a2e;color:#fff;border-radius:8px;padding:16px 20px;margin:16px 0;font-size:13px">
      <p style="margin:0 0 8px;font-weight:bold;font-size:14px">Agreement Accepted</p>
      <table style="font-size:13px;color:#ccc">
        <tr><td style="padding:3px 12px 3px 0;color:#888">Signed by:</td><td><strong style="color:#fff">${signerName || 'N/A'}</strong></td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#888">Date:</td><td>${dateStr}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#888">IP Address:</td><td>${ip || 'N/A'}</td></tr>
      </table>
      <p style="margin:8px 0 0;font-size:11px;color:#666">This constitutes a legally binding electronic signature under the E-SIGN Act and UETA.</p>
    </div>`
}
