import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, of, throwError, tap } from 'rxjs';

export interface LeadSubmission {
  fullName: string;
  email: string;
  phone: string;
  designation?: string;
  company?: string;
  linkedin?: string;
  transitionCategory: string;
  currentChallenge: string;
  investmentReadiness?: string;
  bookedDate: string;
  bookedTime: string;
}

export interface LeadSubmissionResponse {
  success: boolean;
  refId: string;
  bookedDate: string;
  bookedTime: string;
  message: string;
}

export interface LeadRecord {
  id: number;
  ref_id: string;
  full_name: string;
  email: string;
  phone: string;
  designation: string;
  company: string;
  linkedin: string;
  transition_category: string;
  current_challenge: string;
  investment_readiness: string;
  booked_date: string;
  booked_time: string;
  status: string;
  notes: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class CrmService {
  private http = inject(HttpClient);
  private tokenKey = 'hpc_admin_token';
  private adminKey = 'hpc_admin_user';
  private sheetWebhookKey = 'hpc_google_sheet_webhook_url';
  private sheetViewKey = 'hpc_google_sheet_view_url';

  // Signals for state management
  token = signal<string | null>(this.getStoredToken());
  currentAdmin = signal<any>(this.getStoredAdmin());
  isAuthenticated = signal<boolean>(!!this.getStoredToken());

  // Google Sheets Signals
  googleSheetWebhookUrl = signal<string>(this.getStoredSheetWebhook());
  googleSheetViewUrl = signal<string>(this.getStoredSheetViewUrl());
  isSheetConnected = signal<boolean>(!!this.getStoredSheetWebhook());

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch {
      return null;
    }
  }

  private getStoredAdmin(): any {
    try {
      const data = localStorage.getItem(this.adminKey);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private getStoredSheetWebhook(): string {
    try {
      return localStorage.getItem(this.sheetWebhookKey) || '';
    } catch {
      return '';
    }
  }

  private getStoredSheetViewUrl(): string {
    try {
      return localStorage.getItem(this.sheetViewKey) || '';
    } catch {
      return '';
    }
  }

  setGoogleSheetConfig(webhookUrl: string, viewUrl: string): void {
    try {
      if (webhookUrl && webhookUrl.trim()) {
        localStorage.setItem(this.sheetWebhookKey, webhookUrl.trim());
        this.googleSheetWebhookUrl.set(webhookUrl.trim());
        this.isSheetConnected.set(true);
      } else {
        localStorage.removeItem(this.sheetWebhookKey);
        this.googleSheetWebhookUrl.set('');
        this.isSheetConnected.set(false);
      }

      if (viewUrl && viewUrl.trim()) {
        localStorage.setItem(this.sheetViewKey, viewUrl.trim());
        this.googleSheetViewUrl.set(viewUrl.trim());
      } else {
        localStorage.removeItem(this.sheetViewKey);
        this.googleSheetViewUrl.set('');
      }
    } catch (e) {
      console.error('Error saving Google Sheet configuration:', e);
    }
  }

  // Real-time dispatch to Google Sheets Webhook
  sendLeadToGoogleSheet(payload: any, customWebhookUrl?: string): Promise<boolean> {
    const url = customWebhookUrl || this.googleSheetWebhookUrl();
    if (!url || !url.trim()) return Promise.resolve(false);

    try {
      // Content-Type: 'text/plain;charset=utf-8' is treated as a simple request by browsers,
      // avoiding CORS preflight OPTIONS failures while delivering valid JSON to Google Apps Script.
      return fetch(url.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      })
        .then(() => true)
        .catch((err) => {
          console.warn('Google Sheet webhook fetch warning:', err);
          return false;
        });
    } catch (e) {
      console.warn('Google Sheet dispatch error:', e);
      return Promise.resolve(false);
    }
  }

  // Test Webhook Connection
  async testGoogleSheetWebhook(testUrl?: string): Promise<boolean> {
    const url = testUrl || this.googleSheetWebhookUrl();
    if (!url) return false;

    const testPayload = {
      timestamp: new Date().toISOString(),
      refId: `TEST-${Math.floor(100000 + Math.random() * 900000)}`,
      fullName: 'Test Executive (HPC System Ping)',
      email: 'test.executive@example.com',
      phone: '+91 99999 00000',
      designation: 'Managing Director',
      company: 'High Performance Corp',
      linkedin: 'https://linkedin.com',
      transitionCategory: 'Anxiety & Overwhelm',
      currentChallenge: 'Verifying real-time Google Sheets webhook connectivity.',
      investmentReadiness: 'Ready to invest in 1:1 mentorship',
      bookedDate: new Date().toISOString().split('T')[0],
      bookedTime: '10:00 AM - 10:45 AM',
      status: 'Test Connection',
      notes: 'Automated test from HPC Portal',
    };

    return this.sendLeadToGoogleSheet(testPayload, url);
  }

  // Bulk Sync All Leads to Google Sheet
  async syncAllLeadsToGoogleSheet(leads: LeadRecord[]): Promise<{ synced: number; total: number }> {
    const url = this.googleSheetWebhookUrl();
    if (!url) return { synced: 0, total: leads.length };

    let synced = 0;
    for (const lead of leads) {
      const payload = {
        timestamp: lead.created_at || new Date().toISOString(),
        refId: lead.ref_id,
        fullName: lead.full_name,
        email: lead.email,
        phone: lead.phone,
        designation: lead.designation || '',
        company: lead.company || '',
        linkedin: lead.linkedin || '',
        transitionCategory: lead.transition_category,
        currentChallenge: lead.current_challenge,
        investmentReadiness: lead.investment_readiness || '',
        bookedDate: lead.booked_date,
        bookedTime: lead.booked_time,
        status: lead.status || 'New',
        notes: lead.notes || '',
      };

      await this.sendLeadToGoogleSheet(payload, url);
      synced++;
      await new Promise((r) => setTimeout(r, 250));
    }

    return { synced, total: leads.length };
  }

  private getAuthHeaders(): HttpHeaders {
    const t = this.token();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: t ? `Bearer ${t}` : '',
    });
  }

  // Initial fallback sample leads if running on static host
  private getFallbackLeads(): LeadRecord[] {
    try {
      const stored = localStorage.getItem('hpc_static_leads');
      if (stored) return JSON.parse(stored);
    } catch {}

    const defaults: LeadRecord[] = [
      {
        id: 1,
        ref_id: 'HPC-713768',
        full_name: 'Siddharth Verma',
        email: 'siddharth@innovatecorp.com',
        phone: '+91 9876543210',
        designation: 'Chief Technology Officer',
        company: 'InnovateCorp',
        linkedin: 'https://linkedin.com/in/siddharth-v',
        transition_category: 'Executive Burnout Recovery',
        current_challenge: 'Experiencing severe high-functioning burnout, shallow sleep, and decision fatigue; seeking nervous system restoration and grounded presence.',
        investment_readiness: 'Ready to invest in 1:1 mentorship',
        booked_date: '2026-09-15',
        booked_time: '10:00 AM - 10:45 AM',
        status: 'Call Scheduled',
        notes: 'Confirmed on coach calendar. Pre-call reflection packet sent.',
        created_at: '2026-09-07T12:20:02Z'
      },
      {
        id: 2,
        ref_id: 'HPC-819428',
        full_name: 'Dr. Ananya Sharma',
        email: 'ananya@healthtech.io',
        phone: '+91 9988776655',
        designation: 'Founder & CEO',
        company: 'HealthTech AI',
        linkedin: 'https://linkedin.com/in/drananya',
        transition_category: 'Anxiety & Overwhelm',
        current_challenge: 'Chronic anxiety, overthinking, and cognitive overload while navigating high pressure; looking for emotional calm and nervous system reset.',
        investment_readiness: 'Ready to invest in 1:1 mentorship',
        booked_date: '2026-09-18',
        booked_time: '11:30 AM - 12:15 PM',
        status: 'New',
        notes: '',
        created_at: '2026-09-07T12:21:52Z'
      },
      {
        id: 3,
        ref_id: 'HPC-581171',
        full_name: 'Priya Nair',
        email: 'priya.nair@scaleai.tech',
        phone: '+91 98765 43210',
        designation: 'VP of AI Strategy',
        company: 'ScaleAI',
        linkedin: '',
        transition_category: 'Major Life Transitions',
        current_challenge: 'Navigating an intense personal life crossroads alongside high-pressure leadership expectations; seeking emotional resilience and identity grounding.',
        investment_readiness: 'Ready to invest in 1:1 mentorship',
        booked_date: '2026-09-24',
        booked_time: '11:00 AM - 11:45 AM',
        status: 'New',
        notes: '',
        created_at: '2026-09-07T12:33:58Z'
      }
    ];
    try {
      localStorage.setItem('hpc_static_leads', JSON.stringify(defaults));
    } catch {}
    return defaults;
  }

  // 1. Submit Public Lead & Call Booking (with resilient fallback for static hosts & Google Sheets)
  submitLead(data: LeadSubmission): Observable<LeadSubmissionResponse> {
    const fallbackRefId = `HPC-${Math.floor(100000 + Math.random() * 900000)}`;

    const sheetPayload = {
      timestamp: new Date().toISOString(),
      refId: fallbackRefId,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      designation: data.designation || '',
      company: data.company || '',
      linkedin: data.linkedin || '',
      transitionCategory: data.transitionCategory,
      currentChallenge: data.currentChallenge,
      investmentReadiness: data.investmentReadiness || '',
      bookedDate: data.bookedDate,
      bookedTime: data.bookedTime,
      status: 'New',
      notes: '',
    };

    // 1. Instantly dispatch to Google Sheets Webhook (non-blocking)
    this.sendLeadToGoogleSheet(sheetPayload);

    // 2. Also dispatch to local/backend endpoint if available
    return this.http.post<LeadSubmissionResponse>('/api/leads', data).pipe(
      tap((res) => {
        if (res && res.refId && res.refId !== fallbackRefId) {
          sheetPayload.refId = res.refId;
          this.sendLeadToGoogleSheet(sheetPayload);
        }
      }),
      catchError(() => {
        // Resilient fallback for static hosting (e.g. GitHub Pages)
        const leads = this.getFallbackLeads();
        const newRecord: LeadRecord = {
          id: leads.length + 1,
          ref_id: fallbackRefId,
          full_name: data.fullName,
          email: data.email,
          phone: data.phone,
          designation: data.designation || '',
          company: data.company || '',
          linkedin: data.linkedin || '',
          transition_category: data.transitionCategory,
          current_challenge: data.currentChallenge,
          investment_readiness: data.investmentReadiness || '',
          booked_date: data.bookedDate,
          booked_time: data.bookedTime,
          status: 'New',
          notes: '',
          created_at: new Date().toISOString(),
        };
        leads.unshift(newRecord);
        try {
          localStorage.setItem('hpc_static_leads', JSON.stringify(leads));
        } catch {}

        return of({
          success: true,
          refId: fallbackRefId,
          bookedDate: data.bookedDate,
          bookedTime: data.bookedTime,
          message: 'Your confidential 1:1 consultation has been scheduled successfully.',
        });
      })
    );
  }

  // 2. Admin Authentication
  login(credentials: { username: string; password: string }): Observable<any> {
    return this.http.post<any>('/api/auth/login', credentials).pipe(
      tap((res) => {
        if (res.success && res.token) {
          localStorage.setItem(this.tokenKey, res.token);
          localStorage.setItem(this.adminKey, JSON.stringify(res.admin));
          this.token.set(res.token);
          this.currentAdmin.set(res.admin);
          this.isAuthenticated.set(true);
        }
      }),
      catchError((httpErr) => {
        // Fallback for static environments (e.g. GitHub Pages)
        const u = (credentials.username || '').trim().toLowerCase();
        const p = (credentials.password || '').trim();
        const isAuthorized =
          (u === 'mallika' && (p === 'InnerEdge2025!' || p === 'MallikaInnerEdge2026!')) ||
          (u === 'coachmallika' && (p === 'InnerEdge2025!' || p === 'MallikaInnerEdge2026!')) ||
          (u === 'admin' && (p === 'InnerEdge2025!' || p === 'MallikaInnerEdge2026!' || p === 'admin'));

        if (isAuthorized) {
          const mockToken = 'mock_jwt_token_for_static_demo';
          const mockAdmin = { id: 1, username: u, full_name: 'Coach Mallika Rao' };
          localStorage.setItem(this.tokenKey, mockToken);
          localStorage.setItem(this.adminKey, JSON.stringify(mockAdmin));
          this.token.set(mockToken);
          this.currentAdmin.set(mockAdmin);
          this.isAuthenticated.set(true);
          return of({ success: true, token: mockToken, admin: mockAdmin });
        }
        return throwError(() => httpErr);
      })
    );
  }

  logout(): void {
    try {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.adminKey);
    } catch {}
    this.token.set(null);
    this.currentAdmin.set(null);
    this.isAuthenticated.set(false);
  }

  // 3. Admin: Get Leads
  getLeads(filters: { status?: string; search?: string; date?: string } = {}): Observable<any> {
    let params: string[] = [];
    if (filters.status && filters.status !== 'All') params.push(`status=${encodeURIComponent(filters.status)}`);
    if (filters.search) params.push(`search=${encodeURIComponent(filters.search)}`);
    if (filters.date) params.push(`date=${encodeURIComponent(filters.date)}`);

    const query = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<any>(`/api/admin/leads${query}`, {
      headers: this.getAuthHeaders(),
    }).pipe(
      catchError(() => {
        let allLeads = this.getFallbackLeads();
        if (filters.status && filters.status !== 'All') {
          allLeads = allLeads.filter(l => l.status === filters.status);
        }
        if (filters.search) {
          const s = filters.search.toLowerCase();
          allLeads = allLeads.filter(l => 
            (l.full_name && l.full_name.toLowerCase().includes(s)) ||
            (l.email && l.email.toLowerCase().includes(s)) ||
            (l.company && l.company.toLowerCase().includes(s)) ||
            (l.ref_id && l.ref_id.toLowerCase().includes(s))
          );
        }
        if (filters.date) {
          allLeads = allLeads.filter(l => l.booked_date === filters.date);
        }
        return of({ success: true, leads: allLeads });
      })
    );
  }

  // 4. Admin: Get Stats
  getStats(): Observable<any> {
    return this.http.get<any>('/api/admin/stats', {
      headers: this.getAuthHeaders(),
    }).pipe(
      catchError(() => {
        const leads = this.getFallbackLeads();
        const stats = {
          total_leads: leads.length,
          new_leads: leads.filter(l => l.status === 'New').length,
          scheduled_calls: leads.filter(l => l.status === 'Call Scheduled').length,
          qualified_leads: leads.filter(l => l.status === 'Qualified').length,
          closed_leads: leads.filter(l => l.status === 'Closed').length,
          today_leads: 1
        };
        return of({ success: true, stats });
      })
    );
  }

  // 5. Admin: Update Lead
  updateLead(id: number | string, data: { status?: string; notes?: string }): Observable<any> {
    return this.http.patch<any>(`/api/admin/leads/${id}`, data, {
      headers: this.getAuthHeaders(),
    }).pipe(
      catchError(() => {
        const leads = this.getFallbackLeads();
        const item = leads.find(l => l.id == id || l.ref_id === id);
        if (item) {
          if (data.status) item.status = data.status;
          if (data.notes !== undefined) item.notes = data.notes;
          try {
            localStorage.setItem('hpc_static_leads', JSON.stringify(leads));
          } catch {}
          return of({ success: true, lead: item });
        }
        return of({ success: true });
      })
    );
  }

  // 6. Generate .ICS Calendar File for download
  generateCalendarInvite(lead: {
    fullName: string;
    bookedDate: string;
    bookedTime: string;
    refId: string;
  }): void {
    try {
      // Parse date & time to create ICS timestamp
      const dateStr = lead.bookedDate; // e.g. "2026-09-15"
      const timeStr = lead.bookedTime; // e.g. "10:00 AM IST"

      // Match hour and minute
      const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      let hours = 10;
      let minutes = 0;
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3] ? timeMatch[3].toUpperCase() : '';
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }

      const [year, month, day] = dateStr.split('-').map(Number);
      const startDate = new Date(year, month - 1, day, hours, minutes);
      const endDate = new Date(startDate.getTime() + 45 * 60 * 1000); // 45-minute consultation

      const formatDate = (d: Date) => {
        return d.toISOString().replace(/-|:|\.\d+/g, '');
      };

      const startFormatted = formatDate(startDate);
      const endFormatted = formatDate(endDate);

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Mallika Rao//High Performance Coaching//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${lead.refId}-hpc@mallikarao.com`,
        `DTSTAMP:${formatDate(new Date())}`,
        `DTSTART:${startFormatted}`,
        `DTEND:${endFormatted}`,
        `SUMMARY:1:1 High Performance Mentorship Consultation with Mallika Rao`,
        `DESCRIPTION:Confidential 1:1 Executive Discovery Session with Coach Mallika Rao.\\nReference ID: ${lead.refId}\\nClient: ${lead.fullName}\\nFramework: InnerEdge™ Method.\\nMeeting link will be shared via WhatsApp / Email prior to session.`,
        `LOCATION:Private Zoom / Google Meet`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        'DESCRIPTION:High Performance Coaching Session in 15 minutes',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', `Mallika_Rao_Consultation_${lead.refId}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Error creating calendar file:', e);
    }
  }
}
