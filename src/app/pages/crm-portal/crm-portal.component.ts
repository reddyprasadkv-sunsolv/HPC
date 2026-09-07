import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CrmService, LeadRecord } from '../../services/crm.service';

@Component({
  selector: 'app-crm-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './crm-portal.component.html',
  styleUrl: './crm-portal.component.css'
})
export class CrmPortalComponent implements OnInit {
  crmService = inject(CrmService);

  // Authentication
  username = '';
  password = '';
  loginError = signal<string | null>(null);
  isLoggingIn = signal<boolean>(false);

  // Leads & Stats
  leads = signal<LeadRecord[]>([]);
  stats = signal<any>({});
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Filters
  selectedStatus = signal<string>('All');
  searchQuery = signal<string>('');
  selectedDate = signal<string>('');

  // Selected Lead for Detail Modal
  selectedLead = signal<LeadRecord | null>(null);
  editStatus = signal<string>('New');
  editNotes = signal<string>('');
  isUpdating = signal<boolean>(false);
  updateSuccess = signal<boolean>(false);

  ngOnInit(): void {
    if (this.crmService.isAuthenticated()) {
      this.loadDashboardData();
    }
  }

  handleLogin(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.loginError.set('Please enter both username and password.');
      return;
    }

    this.isLoggingIn.set(true);
    this.loginError.set(null);

    this.crmService.login({ username: this.username, password: this.password }).subscribe({
      next: () => {
        this.isLoggingIn.set(false);
        this.loadDashboardData();
      },
      error: (err) => {
        this.isLoggingIn.set(false);
        this.loginError.set(err.error?.error || 'Invalid credentials. Access denied.');
      }
    });
  }

  handleLogout(): void {
    this.crmService.logout();
    this.leads.set([]);
    this.stats.set({});
  }

  loadDashboardData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Fetch Stats
    this.crmService.getStats().subscribe({
      next: (res) => {
        if (res.success) this.stats.set(res.stats);
      },
      error: (e) => console.error('Error fetching stats:', e)
    });

    // Fetch Leads
    this.crmService.getLeads({
      status: this.selectedStatus(),
      search: this.searchQuery(),
      date: this.selectedDate()
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) this.leads.set(res.leads);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 401) {
          this.crmService.logout();
        } else {
          this.errorMessage.set('Failed to load inquiries. Please check network.');
        }
      }
    });
  }

  onFilterChange(): void {
    this.loadDashboardData();
  }

  openLeadDetail(lead: LeadRecord): void {
    this.selectedLead.set(lead);
    this.editStatus.set(lead.status);
    this.editNotes.set(lead.notes || '');
    this.updateSuccess.set(false);
  }

  closeLeadDetail(): void {
    this.selectedLead.set(null);
  }

  saveLeadUpdate(): void {
    const current = this.selectedLead();
    if (!current) return;

    this.isUpdating.set(true);
    this.crmService.updateLead(current.id, {
      status: this.editStatus(),
      notes: this.editNotes()
    }).subscribe({
      next: () => {
        this.isUpdating.set(false);
        this.updateSuccess.set(true);
        // update local list
        this.leads.update(list => list.map(l => l.id === current.id ? { ...l, status: this.editStatus(), notes: this.editNotes() } : l));
        // refresh stats
        this.crmService.getStats().subscribe(res => { if (res.success) this.stats.set(res.stats); });
        setTimeout(() => this.updateSuccess.set(false), 3000);
      },
      error: (err) => {
        this.isUpdating.set(false);
        alert(err.error?.error || 'Failed to update lead');
      }
    });
  }

  exportCsv(): void {
    const token = this.crmService.token();
    if (!token) return;
    
    const headers = new Headers({
      Authorization: `Bearer ${token}`
    });

    fetch('/api/admin/export', { headers })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mallika_rao_hpc_leads_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })
      .catch(e => alert('Failed to download CSV: ' + e));
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'New': return 'status-badge status-new';
      case 'Call Scheduled': return 'status-badge status-scheduled';
      case 'Contacted': return 'status-badge status-contacted';
      case 'Qualified': return 'status-badge status-qualified';
      case 'Closed': return 'status-badge status-closed';
      default: return 'status-badge';
    }
  }

  sendWhatsAppMessage(lead: LeadRecord): void {
    const text = encodeURIComponent(
      `Hello ${lead.full_name}, this is Coach Mallika Rao following up regarding your 1:1 High Performance Mentorship inquiry for ${lead.booked_date} at ${lead.booked_time}.`
    );
    const cleanedPhone = lead.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanedPhone}?text=${text}`, '_blank');
  }
}
