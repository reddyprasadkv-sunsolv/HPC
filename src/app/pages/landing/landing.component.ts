import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmService, LeadSubmission, LeadSubmissionResponse } from '../../services/crm.service';

export interface AssessmentOption {
  key: string;
  letter: string;
  label: string;
  subtext: string;
}

export interface AssessmentQuestion {
  id: number;
  badge: string;
  question: string;
  hint: string;
  options: AssessmentOption[];
}

export interface TransitionArchetype {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  category: string;
  diagnosis: string;
  frictionPoint: string;
  immediateLeverage: string;
  frameworkStages: { step: string; name: string; focus: string }[];
  suggestedChallengeNote: string;
}

interface Testimonial {
  name: string;
  role: string;
  company?: string;
  image: string;
  category: 'founder' | 'corporate' | 'tech';
  quote: string;
  highlight: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  private crmService = inject(CrmService);

  // Active framework tab (1: Calm, 2: Clarity, 3: Confidence, 4: Create)
  activeStage = signal<number>(1);

  // Testimonial category filter ('all' | 'founder' | 'corporate' | 'tech')
  activeTestimonialTab = signal<string>('all');

  // Mobile navigation drawer state
  isMobileMenuOpen = signal<boolean>(false);

  // Interactive Transition Assessment State
  assessmentStep = signal<number>(1); // 1, 2, 3, or 4 (result)
  assessmentAnswers = signal<{ q1: string; q2: string; q3: string }>({ q1: '', q2: '', q3: '' });
  activeArchetype = signal<TransitionArchetype | null>(null);
  linkedArchetype = signal<TransitionArchetype | null>(null);

  // 4 Core Transition Archetypes
  archetypes: Record<string, TransitionArchetype> = {
    'scaled-leader': {
      id: 'scaled-leader',
      title: 'The Scaled Leader at Altitude',
      subtitle: 'High-Altitude Executive, CXO, or Board-Level Scope',
      badge: 'Archetype 01 of 04',
      category: 'Leadership Elevation',
      diagnosis:
        'You have proven your tactical excellence repeatedly, but your expanded scope and high-stakes stakeholder politics demand an entirely different internal operating system. What got you here (hyper-vigilant control, tactical solving) is now causing severe cognitive overload and decision fatigue.',
      frictionPoint:
        'Carrying total accountability with no safe room for vulnerability; chronic 2 AM decision rumination.',
      immediateLeverage:
        'Shift from adrenaline-fueled problem solving to somatic nervous system grounding and decisive executive presence.',
      frameworkStages: [
        { step: 'Stage 1', name: 'CALM', focus: 'Drop fight-or-flight cortisol spikes to restore executive composure under pressure.' },
        { step: 'Stage 2', name: 'CLARITY', focus: 'Filter high-stakes noise and align on the top 2 strategic imperatives that move the needle.' }
      ],
      suggestedChallengeNote:
        'Assessment Profile: The Scaled Leader at Altitude. Navigating high-stakes executive elevation and team scaling; looking to stabilize my nervous system, drop 2 AM decision rumination, and lead with calm executive presence.'
    },
    'sovereign-founder': {
      id: 'sovereign-founder',
      title: 'The Sovereign Founder in Pivot',
      subtitle: 'Corporate Exit, Venture Leap, or Strategic Restructure',
      badge: 'Archetype 02 of 04',
      category: 'Career Transition',
      diagnosis:
        'You are standing at the threshold of leaving the corporate treadmill or pivoting your venture into a bold new chapter. You have immense competence, yet the ambiguity of stepping away from established playbooks triggers quiet paralysis, imposter friction, and identity doubt.',
      frictionPoint:
        'Untangling your intrinsic self-worth from past titles, and navigating high-stakes ambiguity without an institutional safety net.',
      immediateLeverage:
        'Anchor deep internal certainty and sovereign conviction before executing high-stakes tactical leaps.',
      frameworkStages: [
        { step: 'Stage 2', name: 'CLARITY', focus: 'Untangle conditioned identity from your true sovereign vision and strengths.' },
        { step: 'Stage 4', name: 'CREATE', focus: 'Execute a structured, panic-free 90-day transition roadmap with unshakeable focus.' }
      ],
      suggestedChallengeNote:
        'Assessment Profile: The Sovereign Founder in Pivot. Stepping out of corporate/restructure into my own venture; seeking absolute strategic clarity, emotional resilience, and a grounded 90-day execution framework.'
    },
    'resilient-architect': {
      id: 'resilient-architect',
      title: 'The Resilient Architect Reclaiming Power',
      subtitle: 'High-Functioning Burnout & Energy Recovery',
      badge: 'Archetype 03 of 04',
      category: 'High-Stakes Burnout',
      diagnosis:
        'You maintain an impeccable exterior of control and competence, but behind closed doors, your energy reserves are running on fumes. Shallow sleep, morning dread, and emotional numbness are warning lights that your nervous system has lived in chronic survival mode for too long.',
      frictionPoint:
        'High-functioning overdrive: over-delivering for stakeholders while absorbing the emotional and physical toll alone.',
      immediateLeverage:
        'Immediate somatic cortisol reset and establishing non-negotiable energetic boundaries without sacrificing high performance.',
      frameworkStages: [
        { step: 'Stage 1', name: 'CALM', focus: 'Somatic nervous system reset, EFT tapping regulation, and restorative sleep recovery.' },
        { step: 'Stage 3', name: 'CONFIDENCE', focus: 'Rebuild internal energetic self-trust and command authority without self-sacrifice.' }
      ],
      suggestedChallengeNote:
        'Assessment Profile: The Resilient Architect Reclaiming Power. Experiencing high-functioning burnout, chronic cortisol fatigue, and shallow sleep; seeking immediate somatic reset and firm executive boundaries.'
    },
    'life-sovereign': {
      id: 'life-sovereign',
      title: 'The Life & Identity Sovereign',
      subtitle: 'Personal Crossroads, Life Transition, or Mid-Career Realignment',
      badge: 'Archetype 04 of 04',
      category: 'Personal Crossroads',
      diagnosis:
        'A profound personal inflection point (divorce, health event, loss, or existential life re-evaluation) has shaken your internal foundation. Trying to lead teams and sustain high performance while carrying private emotional grief is exhausting. You are ready to realign who you truly are with how you lead.',
      frictionPoint:
        'Carrying private emotional turmoil while projecting executive composure; feeling deeply isolated at the top.',
      immediateLeverage:
        'Safely processing the emotional inflection point so you lead your next chapter from authentic peace rather than unhealed fatigue.',
      frameworkStages: [
        { step: 'Stage 1', name: 'CALM', focus: 'Release somatic grief and suppressed tension to restore emotional equilibrium.' },
        { step: 'Stage 4', name: 'CREATE', focus: 'Design a unified life and leadership blueprint aligned with your authentic core.' }
      ],
      suggestedChallengeNote:
        'Assessment Profile: The Life & Identity Sovereign. Navigating a major personal life transition alongside leadership responsibilities; seeking emotional grounding, inner clarity, and authentic direction for my next chapter.'
    }
  };

  // 3 Diagnostic Questions
  assessmentQuestions: AssessmentQuestion[] = [
    {
      id: 1,
      badge: 'Question 01 of 03 • Current Inflection Point',
      question: 'Where is your primary crossroads concentrated right now?',
      hint: 'Select the reality that most closely mirrors your current landscape.',
      options: [
        {
          key: 'scaled-leader',
          letter: 'A',
          label: 'Expanded Leadership Scope (CXO, VP, or Board-Level Elevation)',
          subtext: 'Stepping into bigger roles where stakes, team dynamics, and politics demand higher executive presence.'
        },
        {
          key: 'sovereign-founder',
          letter: 'B',
          label: 'High-Stakes Pivot (Corporate to Venture, Restructuring, or Exit)',
          subtext: 'Leaving the corporate treadmill or pivoting your venture into uncharted, ambiguous territory.'
        },
        {
          key: 'resilient-architect',
          letter: 'C',
          label: 'High-Functioning Burnout & Energy Depletion',
          subtext: 'Succeeding on paper, but privately exhausted, running on chronic adrenaline, and waking up with dread.'
        },
        {
          key: 'life-sovereign',
          letter: 'D',
          label: 'Personal Crossroads or Identity Re-evaluation',
          subtext: 'Navigating divorce, grief, health, or a profound re-examination of what truly matters in your next chapter.'
        }
      ]
    },
    {
      id: 2,
      badge: 'Question 02 of 03 • The Internal Friction',
      question: 'What is your single most exhausting internal loop?',
      hint: 'What drains your mental and emotional bandwidth behind closed doors?',
      options: [
        {
          key: 'rumination',
          letter: 'A',
          label: '2 AM Decision Rumination & Mental Loops',
          subtext: 'Second-guessing strategic calls, feeling isolated at the top, and replaying scenarios obsessively.'
        },
        {
          key: 'somatic',
          letter: 'B',
          label: 'Chronic Physical Tension & Broken Sleep',
          subtext: 'Tight neck/shoulders, shallow sleep, irritability with loved ones, and living on cortisol spikes.'
        },
        {
          key: 'ambiguity',
          letter: 'C',
          label: 'Strategic Ambiguity & Identity Imposter Pressure',
          subtext: 'High external capability, but quiet internal uncertainty about your authentic direction and worth.'
        },
        {
          key: 'boundary',
          letter: 'D',
          label: 'Boundary Depletion & Emotional Spillover',
          subtext: 'Giving 100% to employees and stakeholders, leaving zero emotional reserve for yourself and family.'
        }
      ]
    },
    {
      id: 3,
      badge: 'Question 03 of 03 • The Desired Breakthrough',
      question: 'What fundamental shift would unlock the highest leverage for you?',
      hint: 'If you could resolve one core barrier over the next 90 days, what would it be?',
      options: [
        {
          key: 'composure',
          letter: 'A',
          label: 'Unshakeable Nervous System & Executive Composure',
          subtext: 'A calm, grounded internal anchor that never shakes regardless of organizational volatility.'
        },
        {
          key: 'clarity',
          letter: 'B',
          label: 'Decisive Strategic Clarity & Bold Direction',
          subtext: 'Silencing mental clutter, eliminating overthinking, and executing key transitions with total conviction.'
        },
        {
          key: 'vitality',
          letter: 'C',
          label: 'Deep Vitality, Restored Sleep & Sovereign Boundaries',
          subtext: 'Dropping chronic fatigue, waking up energized, and protecting non-negotiable personal margins.'
        },
        {
          key: 'integration',
          letter: 'D',
          label: 'Authentic Life Integration & Sovereign Next Chapter',
          subtext: 'Aligning your ambition, relationships, and inner truth into a fulfilling, sustainable future.'
        }
      ]
    }
  ];

  // Booking Form Multi-step state
  currentStep = signal<number>(1);
  isSubmitting = signal<boolean>(false);
  submissionError = signal<string | null>(null);
  bookingConfirmed = signal<LeadSubmissionResponse | null>(null);

  // Form Model
  formModel: LeadSubmission = {
    fullName: '',
    email: '',
    phone: '',
    designation: '',
    company: '',
    linkedin: '',
    transitionCategory: 'Career Transition',
    currentChallenge: '',
    investmentReadiness: 'Ready to invest in 1:1 mentorship',
    bookedDate: this.getDefaultDate(),
    bookedTime: '10:00 AM - 10:45 AM'
  };

  // Available Time Slots grouped by day period
  timeSlots = [
    { period: 'Morning Slots', times: ['10:00 AM - 10:45 AM', '11:30 AM - 12:15 PM'] },
    { period: 'Afternoon Slots', times: ['02:00 PM - 02:45 PM', '03:30 PM - 04:15 PM'] },
    { period: 'Evening Slots', times: ['05:00 PM - 05:45 PM', '06:30 PM - 07:15 PM'] }
  ];

  // Minimum date for booking (tomorrow)
  minBookingDate = this.getDefaultDate();
  maxBookingDate = this.getMaxDate();

  // Testimonials database with real verified clients & high-res images
  testimonials: Testimonial[] = [
    {
      name: 'Ranjith Reddy V',
      role: 'Innovation and AI Coach',
      company: 'Tech & AI Ecosystem',
      image: 'assets/images/ranjith.jpg',
      category: 'tech',
      highlight: 'Vision boards came to life with tangible clarity',
      quote: `I was introduced to Mallika four years ago when I was going through a very difficult time in my life. With her guidance, I've become more self-aware, breaking through each limiting belief, stopped seeing myself as a victim, and embraced life's joyful efforts. The changes in my life have been tangible and concrete, attracting new people, opportunities, and fulfilling relationships. Mallika's help has been instrumental in envisioning what I truly need and want with such clarity that my vision boards come to life.`
    },
    {
      name: 'Ratna Kalluri',
      role: 'Founder & Creative Director',
      company: 'Rad Studio',
      image: 'assets/images/ratna.jpg',
      category: 'founder',
      highlight: 'I lacked clarity & felt stuck. Now confident about my path',
      quote: `In her first discovery call, there were 3 questions, out of which one hit me hard: Clarity. I lacked clarity and focus about my work and the future of my business. It's been months working with Mallika Rao and I feel confident about my goals, path, and future as we work systematically towards them every week. She is organized, committed, dependable, and genuinely interested in positive transformation.`
    },
    {
      name: 'Vivek Thiruvengadam',
      role: 'Founder',
      company: 'QubitFit',
      image: 'assets/images/vivek.jpg',
      category: 'founder',
      highlight: 'Best decision of 2023 was to get my mindset in control',
      quote: `As an entrepreneur and startup owner, it was getting tough to manage everything – business, family, and needs. I was struggling to get my mindset right and that showed in all my actions. I started working with Mallika and practicing her lessons. Within weeks, her coaching brought so much clarity in my decision-making process for both business and personal life. Mallika is the best out here, hands down.`
    },
    {
      name: 'Suresh Dara',
      role: 'EVP Growth',
      company: 'iMark Developers',
      image: 'assets/images/suresh.jpg',
      category: 'corporate',
      highlight: 'Rebuilt confidence & health after losing business in COVID',
      quote: `During COVID-19, I lost my business and was hospitalized with severe complications. It was challenging physically, mentally, and financially. That's when I connected with Coach Mallika Rao, and magic happened! Her program was immensely helpful in my personal and professional growth. Now I hold a senior corporate executive position which would not have been possible without her coaching.`
    },
    {
      name: 'Madhan Sundhar N',
      role: 'Sales Professional & Leader',
      company: 'Enterprise Growth',
      image: 'assets/images/madan.jpg',
      category: 'corporate',
      highlight: 'Unlocked potential through mindfulness & Wheels of Life',
      quote: `Mallika introduced me to a new way of looking at life through the 'Wheels of Life,' exploring dimensions beyond just work. A significant part involved mindfulness, helping me stay present, grounded, and calm in moments of overwhelm. Her coaching truly equips leaders to thrive.`
    },
    {
      name: 'Ajit Jagannathan',
      role: 'Co-Founder',
      company: 'My Perfect Fit Group',
      image: 'assets/images/ajit.jpg',
      category: 'founder',
      highlight: 'Turned productivity around; changes noticed by my team & wife',
      quote: `Before working with Mallika, I was overwhelmed by work pressure and my productivity was plummeting. Enrolling in Mallika's High Performance Coaching turned things around. The changes were so clear that my wife and team noticed them too. I am now more clear, focused, productive, and enjoying work-life balance like never before.`
    },
    {
      name: 'Tomasz Walczak',
      role: 'Director Project Portfolio Management',
      company: 'Green Gold Animation Pvt Ltd',
      image: 'assets/images/tomasz.jpg',
      category: 'tech',
      highlight: 'Meditation apps failed me. Mallika made meditation life-changing',
      quote: `I have tried meditation apps before but they did not work for me. I was struggling with stress, anxiety, and overwhelm. 'Finding Calm in Chaos' was an incredible experience. Having a professional Coach and Meditator like Mallika guide you personally makes a world of difference.`
    },
    {
      name: 'Kishan Dumpeta',
      role: 'CEO',
      company: 'Tierra Agrotech Ltd',
      image: 'assets/images/kishan.jpg',
      category: 'corporate',
      highlight: 'In just one session, released emotional blockages holding me back',
      quote: `In just one session, Mallika helped me gain clarity on what was draining my energies and what my vision for life was. She took me through an EFT therapy session followed by mindfulness meditation. I felt completely calm and at peace after so many days.`
    },
    {
      name: 'Hridaynath Bharaadwaj',
      role: 'Founder & Tech Entrepreneur',
      company: 'Wenalytics IoT Solutions',
      image: 'assets/images/hridaynath.jpg',
      category: 'founder',
      highlight: 'Rope-walking 2 high-stress careers made clear in 4 sessions',
      quote: `I was trying to rope walk 2 careers: as an actor and as a founder of a tech startup with global presence. In about 3 to 4 sessions with Mallika, I was able to look at my career objectively, see through the clutter in my mind, and make quicker, clearer decisions.`
    },
    {
      name: 'Koula Achillea',
      role: 'Learning & Development Professional',
      company: 'Executive Talent',
      image: 'assets/images/koula.jpg',
      category: 'corporate',
      highlight: 'Helped solve life like a jigsaw puzzle, piece by piece',
      quote: `To me a challenge in life is like a jigsaw puzzle thrown on the floor. Mallika helps by identifying each piece until all pieces come together and your mind is at peace. She has an amazing way of helping you see things differently.`
    },
    {
      name: 'Latha Reddy',
      role: 'Strategic Leader & Entrepreneur',
      company: 'Strategic Ventures',
      image: 'assets/images/latha.jpg',
      category: 'corporate',
      highlight: 'A master of life coaching and wellness in one unified approach',
      quote: `Mallika has mastered this art. Her character is truly amazing and she has proven her mettle. A wonderful life coach and wellness mentor who brings holistic transformation.`
    },
    {
      name: 'Shalabh Jain',
      role: 'Operations & Business Strategist',
      company: 'Change Management Advisory',
      image: 'assets/images/shalabh.jpg',
      category: 'corporate',
      highlight: 'Empathetic, non-judgmental guidance for high-pressure decisions',
      quote: `Mallika has mastered this art very well. I had an opportunity to have one-on-one conversations on several strategic issues. Her approach puts you in a place of total clarity and assurance.`
    }
  ];

  get filteredTestimonials(): Testimonial[] {
    const tab = this.activeTestimonialTab();
    if (tab === 'all') return this.testimonials;
    return this.testimonials.filter(t => t.category === tab);
  }

  setStage(stageNum: number): void {
    this.activeStage.set(stageNum);
  }

  setTestimonialTab(tab: string): void {
    this.activeTestimonialTab.set(tab);
  }

  nextStep(): void {
    this.submissionError.set(null);
    if (this.currentStep() === 1) {
      if (!this.formModel.fullName.trim() || !this.formModel.email.trim() || !this.formModel.phone.trim()) {
        this.submissionError.set('Please fill in your name, email, and phone number to proceed.');
        return;
      }
      this.currentStep.set(2);
    } else if (this.currentStep() === 2) {
      if (!this.formModel.currentChallenge.trim()) {
        this.submissionError.set('Please share a brief note about the transition or roadblock you are facing.');
        return;
      }
      this.currentStep.set(3);
    }
  }

  prevStep(): void {
    this.submissionError.set(null);
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  selectTimeSlot(time: string): void {
    this.formModel.bookedTime = time;
  }

  submitBooking(): void {
    if (!this.formModel.bookedDate || !this.formModel.bookedTime) {
      this.submissionError.set('Please select your preferred date and time slot.');
      return;
    }

    this.isSubmitting.set(true);
    this.submissionError.set(null);

    this.crmService.submitLead(this.formModel).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.bookingConfirmed.set(res);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.submissionError.set(
          err.error?.error || 'Unable to submit booking. Please check your network and try again.'
        );
      }
    });
  }

  downloadCalendar(): void {
    const confirmed = this.bookingConfirmed();
    if (confirmed) {
      this.crmService.generateCalendarInvite({
        fullName: this.formModel.fullName,
        bookedDate: confirmed.bookedDate,
        bookedTime: confirmed.bookedTime,
        refId: confirmed.refId
      });
    }
  }

  openWhatsApp(): void {
    const confirmed = this.bookingConfirmed();
    const ref = confirmed ? confirmed.refId : 'HPC-Discovery';
    const text = encodeURIComponent(
      `Hello Coach Mallika, I just booked my 1:1 High Performance Coaching consultation (Ref: ${ref}). Looking forward to our conversation.`
    );
    window.open(`https://wa.me/919989679999?text=${text}`, '_blank');
  }

  resetBooking(): void {
    this.bookingConfirmed.set(null);
    this.currentStep.set(1);
    this.formModel = {
      fullName: '',
      email: '',
      phone: '',
      designation: '',
      company: '',
      linkedin: '',
      transitionCategory: 'Career Transition',
      currentChallenge: '',
      investmentReadiness: 'Ready to invest in 1:1 mentorship',
      bookedDate: this.getDefaultDate(),
      bookedTime: '10:00 AM - 10:45 AM'
    };
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(v => !v);
  }

  // Assessment Actions
  selectAssessmentOption(qKey: 'q1' | 'q2' | 'q3', optionKey: string): void {
    this.assessmentAnswers.update(answers => ({
      ...answers,
      [qKey]: optionKey
    }));
  }

  isOptionSelected(qKey: 'q1' | 'q2' | 'q3', optionKey: string): boolean {
    return this.assessmentAnswers()[qKey] === optionKey;
  }

  canProceedAssessment(): boolean {
    const step = this.assessmentStep();
    const answers = this.assessmentAnswers();
    if (step === 1) return !!answers.q1;
    if (step === 2) return !!answers.q2;
    if (step === 3) return !!answers.q3;
    return false;
  }

  nextAssessmentStep(): void {
    if (!this.canProceedAssessment()) return;
    if (this.assessmentStep() < 3) {
      this.assessmentStep.update(s => s + 1);
    } else {
      this.calculateArchetype();
      this.assessmentStep.set(4);
    }
  }

  prevAssessmentStep(): void {
    if (this.assessmentStep() > 1) {
      this.assessmentStep.update(s => s - 1);
    }
  }

  calculateArchetype(): void {
    const answers = this.assessmentAnswers();
    const archetypeKey = answers.q1 || 'scaled-leader';
    const archetype = this.archetypes[archetypeKey] || this.archetypes['scaled-leader'];
    this.activeArchetype.set(archetype);
  }

  resetAssessment(): void {
    this.assessmentAnswers.set({ q1: '', q2: '', q3: '' });
    this.activeArchetype.set(null);
    this.assessmentStep.set(1);
  }

  applyAssessmentToBooking(): void {
    const arch = this.activeArchetype();
    if (!arch) return;

    this.linkedArchetype.set(arch);
    this.formModel.transitionCategory = arch.category;

    if (!this.formModel.currentChallenge.trim() || this.formModel.currentChallenge.startsWith('Assessment Profile:')) {
      this.formModel.currentChallenge = arch.suggestedChallengeNote;
    }

    this.scrollToBooking();
  }

  clearLinkedAssessment(): void {
    this.linkedArchetype.set(null);
  }

  scrollToAssessment(): void {
    this.closeMobileMenu();
    const el = document.getElementById('assessment');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  scrollToBooking(): void {
    this.closeMobileMenu();
    const el = document.getElementById('book-consultation');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private getDefaultDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 2); // default 2 days ahead
    return d.toISOString().split('T')[0];
  }

  private getMaxDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 35); // up to 35 days ahead
    return d.toISOString().split('T')[0];
  }
}
