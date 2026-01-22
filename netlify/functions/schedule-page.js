/**
 * Scheduling Page
 * Public booking page for team members
 * /schedule/{username} or /.netlify/functions/schedule-page?user=username
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    // Get username from path or query
    const pathParts = event.path.split('/');
    const username = event.queryStringParameters?.user || pathParts[pathParts.length - 1];
    
    if (!username || username === 'schedule-page') {
      return { statusCode: 404, headers, body: renderNotFound() };
    }

    // Get team member by username/email
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('*')
      .or(`username.eq.${username},email.ilike.${username}@%`)
      .single();

    if (!teamMember) {
      return { statusCode: 404, headers, body: renderNotFound() };
    }

    // Get their meeting types
    const { data: meetingTypes } = await supabase
      .from('meeting_types')
      .select('*')
      .eq('team_member_id', teamMember.id)
      .eq('is_active', true)
      .order('duration_minutes', { ascending: true });

    // Render the booking page
    return {
      statusCode: 200,
      headers,
      body: renderBookingPage(teamMember, meetingTypes || [])
    };

  } catch (err) {
    console.error('Schedule page error:', err);
    return { statusCode: 500, headers, body: renderError() };
  }
};

function renderBookingPage(member, meetingTypes) {
  const displayName = member.name || member.email.split('@')[0];
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Schedule with ${escapeHtml(displayName)} | joe</title>
  <link rel="icon" type="image/png" href="/images/logo.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #f5f5f5; color: #111; min-height: 100vh; }
    
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    
    /* Header */
    .header { text-align: center; margin-bottom: 32px; }
    .avatar { width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 16px; overflow: hidden; background: #111; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28px; font-weight: 600; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .name { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
    .company { color: #666; font-size: 14px; }
    
    /* Main Layout */
    .booking-layout { display: grid; grid-template-columns: 300px 1fr; gap: 24px; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
    
    /* Sidebar - Meeting Types */
    .sidebar { background: #fafafa; padding: 24px; border-right: 1px solid #eee; }
    .sidebar h3 { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    .meeting-type { padding: 16px; border: 2px solid #e5e5e5; border-radius: 12px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s; }
    .meeting-type:hover { border-color: #999; }
    .meeting-type.selected { border-color: #111; background: #fff; }
    .meeting-type-name { font-weight: 600; margin-bottom: 4px; }
    .meeting-type-duration { font-size: 13px; color: #666; display: flex; align-items: center; gap: 4px; }
    .meeting-type-desc { font-size: 12px; color: #888; margin-top: 8px; }
    .duration-badge { display: inline-flex; align-items: center; gap: 4px; background: #f0f0f0; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    
    /* Calendar */
    .calendar-section { padding: 24px; }
    .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .calendar-title { font-size: 18px; font-weight: 600; }
    .calendar-nav { display: flex; gap: 8px; }
    .calendar-nav button { width: 36px; height: 36px; border: 1px solid #ddd; background: #fff; border-radius: 8px; cursor: pointer; font-size: 16px; }
    .calendar-nav button:hover { background: #f5f5f5; }
    
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .calendar-day-header { text-align: center; font-size: 12px; color: #666; padding: 8px; font-weight: 500; }
    .calendar-day { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
    .calendar-day:hover:not(.disabled):not(.empty) { background: #f0f0f0; }
    .calendar-day.empty { cursor: default; }
    .calendar-day.disabled { color: #ccc; cursor: not-allowed; }
    .calendar-day.selected { background: #111; color: #fff; }
    .calendar-day.today { font-weight: 700; box-shadow: inset 0 0 0 2px #111; }
    .calendar-day.has-slots::after { content: ''; position: absolute; bottom: 4px; width: 4px; height: 4px; background: #10b981; border-radius: 50%; }
    .calendar-day { position: relative; }
    
    /* Time Slots */
    .time-section { margin-top: 24px; display: none; }
    .time-section.visible { display: block; }
    .time-header { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .time-slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-height: 200px; overflow-y: auto; }
    .time-slot { padding: 10px; text-align: center; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
    .time-slot:hover { border-color: #111; background: #fafafa; }
    .time-slot.selected { background: #111; color: #fff; border-color: #111; }
    .time-slot.unavailable { color: #ccc; cursor: not-allowed; text-decoration: line-through; }
    
    /* Booking Form */
    .booking-form { margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; display: none; }
    .booking-form.visible { display: block; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
    .form-group input, .form-group textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; font-family: inherit; }
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #111; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    
    .btn-book { width: 100%; padding: 14px; background: #111; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn-book:hover { background: #333; }
    .btn-book:disabled { background: #ccc; cursor: not-allowed; }
    
    /* Confirmation */
    .confirmation { display: none; text-align: center; padding: 40px; }
    .confirmation.visible { display: block; }
    .confirmation-icon { width: 64px; height: 64px; background: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; }
    .confirmation h2 { margin-bottom: 8px; }
    .confirmation p { color: #666; margin-bottom: 24px; }
    .meeting-details { background: #f5f5f5; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 24px; }
    .meeting-details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
    .meeting-details-row:last-child { border-bottom: none; }
    .meeting-details-label { color: #666; }
    
    .add-to-calendar { display: inline-flex; gap: 12px; }
    .add-to-calendar a { padding: 10px 16px; border: 1px solid #ddd; border-radius: 8px; text-decoration: none; color: #111; font-size: 13px; }
    .add-to-calendar a:hover { background: #f5f5f5; }
    
    /* Powered by */
    .powered-by { text-align: center; margin-top: 32px; font-size: 12px; color: #999; }
    .powered-by a { color: #666; text-decoration: none; }
    
    /* Loading */
    .loading { display: none; text-align: center; padding: 40px; }
    .loading.visible { display: block; }
    .spinner { width: 40px; height: 40px; border: 3px solid #f0f0f0; border-top-color: #111; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    /* Responsive */
    @media (max-width: 768px) {
      .booking-layout { grid-template-columns: 1fr; }
      .sidebar { border-right: none; border-bottom: 1px solid #eee; }
      .time-slots { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="avatar" id="avatar">
        ${member.photo_url ? `<img src="${escapeHtml(member.photo_url)}" alt="${escapeHtml(displayName)}">` : initials}
      </div>
      <div class="name">${escapeHtml(displayName)}</div>
      <div class="company">joe coffee</div>
    </div>
    
    <div class="booking-layout">
      <div class="sidebar">
        <h3>Select Meeting Type</h3>
        ${meetingTypes.length ? meetingTypes.map((mt, i) => `
          <div class="meeting-type ${i === 0 ? 'selected' : ''}" data-id="${mt.id}" data-duration="${mt.duration_minutes}" onclick="selectMeetingType(this)">
            <div class="meeting-type-name">${escapeHtml(mt.name)}</div>
            <div class="meeting-type-duration">
              <span class="duration-badge">🕐 ${mt.duration_minutes} min</span>
            </div>
            ${mt.description ? `<div class="meeting-type-desc">${escapeHtml(mt.description)}</div>` : ''}
          </div>
        `).join('') : `
          <div style="color:#666;font-size:14px">No meeting types available yet.</div>
        `}
      </div>
      
      <div class="calendar-section" id="calendarSection">
        <div class="loading" id="loadingCalendar">
          <div class="spinner"></div>
          <div>Loading availability...</div>
        </div>
        
        <div id="calendarContent">
          <div class="calendar-header">
            <div class="calendar-title" id="calendarTitle">January 2026</div>
            <div class="calendar-nav">
              <button onclick="prevMonth()">←</button>
              <button onclick="nextMonth()">→</button>
            </div>
          </div>
          
          <div class="calendar-grid" id="calendarGrid">
            <div class="calendar-day-header">Sun</div>
            <div class="calendar-day-header">Mon</div>
            <div class="calendar-day-header">Tue</div>
            <div class="calendar-day-header">Wed</div>
            <div class="calendar-day-header">Thu</div>
            <div class="calendar-day-header">Fri</div>
            <div class="calendar-day-header">Sat</div>
          </div>
          
          <div class="time-section" id="timeSection">
            <div class="time-header" id="timeHeader">Available times</div>
            <div class="time-slots" id="timeSlots"></div>
          </div>
          
          <div class="booking-form" id="bookingForm">
            <div class="form-row">
              <div class="form-group">
                <label>First Name *</label>
                <input type="text" id="bookerFirstName" required>
              </div>
              <div class="form-group">
                <label>Last Name *</label>
                <input type="text" id="bookerLastName" required>
              </div>
            </div>
            <div class="form-group">
              <label>Email *</label>
              <input type="email" id="bookerEmail" required>
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" id="bookerPhone">
            </div>
            <div class="form-group">
              <label>Notes (optional)</label>
              <textarea id="bookerNotes" rows="3" placeholder="What would you like to discuss?"></textarea>
            </div>
            <button class="btn-book" onclick="confirmBooking()" id="bookBtn">Confirm Booking</button>
          </div>
        </div>
        
        <div class="confirmation" id="confirmation">
          <div class="confirmation-icon">✓</div>
          <h2>Meeting Booked!</h2>
          <p>You'll receive a confirmation email with the meeting details.</p>
          <div class="meeting-details" id="meetingDetails"></div>
          <div class="add-to-calendar" id="addToCalendar"></div>
        </div>
      </div>
    </div>
    
    <div class="powered-by">
      Powered by <a href="https://joe.coffee">joe</a>
    </div>
  </div>

  <script>
    const teamMemberId = '${member.id}';
    const teamMemberEmail = '${member.email}';
    const teamMemberName = '${escapeHtml(displayName)}';
    const meetingTypes = ${JSON.stringify(meetingTypes)};
    
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let selectedDate = null;
    let selectedTime = null;
    let selectedMeetingType = meetingTypes[0] || null;
    let availability = {};
    
    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      renderCalendar();
      if (selectedMeetingType) {
        fetchAvailability();
      }
    });
    
    function selectMeetingType(el) {
      document.querySelectorAll('.meeting-type').forEach(m => m.classList.remove('selected'));
      el.classList.add('selected');
      selectedMeetingType = meetingTypes.find(m => m.id === el.dataset.id);
      selectedDate = null;
      selectedTime = null;
      document.getElementById('timeSection').classList.remove('visible');
      document.getElementById('bookingForm').classList.remove('visible');
      fetchAvailability();
    }
    
    async function fetchAvailability() {
      if (!selectedMeetingType) return;
      
      document.getElementById('loadingCalendar').classList.add('visible');
      document.getElementById('calendarContent').style.opacity = '0.5';
      
      try {
        const startDate = new Date(currentYear, currentMonth, 1);
        const endDate = new Date(currentYear, currentMonth + 2, 0); // 2 months
        
        const response = await fetch('/.netlify/functions/schedule-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_member_id: teamMemberId,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            duration: selectedMeetingType.duration_minutes
          })
        });
        
        const data = await response.json();
        availability = data.availability || {};
        renderCalendar();
      } catch (err) {
        console.error('Error fetching availability:', err);
      } finally {
        document.getElementById('loadingCalendar').classList.remove('visible');
        document.getElementById('calendarContent').style.opacity = '1';
      }
    }
    
    function renderCalendar() {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      document.getElementById('calendarTitle').textContent = months[currentMonth] + ' ' + currentYear;
      
      const grid = document.getElementById('calendarGrid');
      // Keep headers
      grid.innerHTML = \`
        <div class="calendar-day-header">Sun</div>
        <div class="calendar-day-header">Mon</div>
        <div class="calendar-day-header">Tue</div>
        <div class="calendar-day-header">Wed</div>
        <div class="calendar-day-header">Thu</div>
        <div class="calendar-day-header">Fri</div>
        <div class="calendar-day-header">Sat</div>
      \`;
      
      const firstDay = new Date(currentYear, currentMonth, 1).getDay();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Empty cells before first day
      for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += '<div class="calendar-day empty"></div>';
      }
      
      // Days of month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = date.toISOString().split('T')[0];
        const isPast = date < today;
        const isToday = date.getTime() === today.getTime();
        const hasSlots = availability[dateStr] && availability[dateStr].length > 0;
        const isSelected = selectedDate === dateStr;
        
        let classes = 'calendar-day';
        if (isPast) classes += ' disabled';
        if (isToday) classes += ' today';
        if (hasSlots) classes += ' has-slots';
        if (isSelected) classes += ' selected';
        
        grid.innerHTML += \`<div class="\${classes}" data-date="\${dateStr}" onclick="selectDate('\${dateStr}', \${isPast})">\${day}</div>\`;
      }
    }
    
    function selectDate(dateStr, isPast) {
      if (isPast) return;
      
      selectedDate = dateStr;
      selectedTime = null;
      
      document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
      document.querySelector(\`.calendar-day[data-date="\${dateStr}"]\`)?.classList.add('selected');
      
      renderTimeSlots();
    }
    
    function renderTimeSlots() {
      const slots = availability[selectedDate] || [];
      const container = document.getElementById('timeSlots');
      const section = document.getElementById('timeSection');
      
      if (!slots.length) {
        container.innerHTML = '<div style="grid-column:1/-1;color:#666;padding:20px;text-align:center">No available times on this date</div>';
        section.classList.add('visible');
        document.getElementById('bookingForm').classList.remove('visible');
        return;
      }
      
      const date = new Date(selectedDate);
      document.getElementById('timeHeader').textContent = 'Available times for ' + date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      
      container.innerHTML = slots.map(slot => \`
        <div class="time-slot" data-time="\${slot}" onclick="selectTime('\${slot}')">\${formatTime(slot)}</div>
      \`).join('');
      
      section.classList.add('visible');
      document.getElementById('bookingForm').classList.remove('visible');
    }
    
    function formatTime(time24) {
      const [hours, minutes] = time24.split(':');
      const h = parseInt(hours);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return h12 + ':' + minutes + ' ' + ampm;
    }
    
    function selectTime(time) {
      selectedTime = time;
      
      document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      document.querySelector(\`.time-slot[data-time="\${time}"]\`)?.classList.add('selected');
      
      document.getElementById('bookingForm').classList.add('visible');
    }
    
    function prevMonth() {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      fetchAvailability();
    }
    
    function nextMonth() {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      fetchAvailability();
    }
    
    async function confirmBooking() {
      const firstName = document.getElementById('bookerFirstName').value.trim();
      const lastName = document.getElementById('bookerLastName').value.trim();
      const email = document.getElementById('bookerEmail').value.trim();
      const phone = document.getElementById('bookerPhone').value.trim();
      const notes = document.getElementById('bookerNotes').value.trim();
      
      if (!firstName || !lastName || !email) {
        alert('Please fill in all required fields');
        return;
      }
      
      const btn = document.getElementById('bookBtn');
      btn.disabled = true;
      btn.textContent = 'Booking...';
      
      try {
        const response = await fetch('/.netlify/functions/schedule-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_member_id: teamMemberId,
            meeting_type_id: selectedMeetingType.id,
            date: selectedDate,
            time: selectedTime,
            booker: { firstName, lastName, email, phone, notes }
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showConfirmation(data);
        } else {
          alert(data.error || 'Failed to book meeting. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Confirm Booking';
        }
      } catch (err) {
        console.error('Booking error:', err);
        alert('An error occurred. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Confirm Booking';
      }
    }
    
    function showConfirmation(data) {
      document.getElementById('calendarContent').style.display = 'none';
      const conf = document.getElementById('confirmation');
      conf.classList.add('visible');
      
      const date = new Date(selectedDate + 'T' + selectedTime);
      const endDate = new Date(date.getTime() + selectedMeetingType.duration_minutes * 60000);
      
      document.getElementById('meetingDetails').innerHTML = \`
        <div class="meeting-details-row">
          <span class="meeting-details-label">Meeting</span>
          <span>\${selectedMeetingType.name}</span>
        </div>
        <div class="meeting-details-row">
          <span class="meeting-details-label">With</span>
          <span>\${teamMemberName}</span>
        </div>
        <div class="meeting-details-row">
          <span class="meeting-details-label">Date</span>
          <span>\${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div class="meeting-details-row">
          <span class="meeting-details-label">Time</span>
          <span>\${formatTime(selectedTime)} - \${formatTime(endDate.toTimeString().slice(0,5))}</span>
        </div>
        \${data.meet_link ? \`
        <div class="meeting-details-row">
          <span class="meeting-details-label">Join Link</span>
          <a href="\${data.meet_link}" target="_blank" style="color:#1a73e8">\${data.meet_link}</a>
        </div>
        \` : ''}
      \`;
      
      // Add to calendar links
      const title = encodeURIComponent(selectedMeetingType.name + ' with ' + teamMemberName);
      const details = encodeURIComponent('Meeting booked via joe scheduling\\n' + (data.meet_link ? 'Join: ' + data.meet_link : ''));
      const startISO = date.toISOString().replace(/[-:]/g, '').replace('.000', '');
      const endISO = endDate.toISOString().replace(/[-:]/g, '').replace('.000', '');
      
      const googleUrl = \`https://calendar.google.com/calendar/render?action=TEMPLATE&text=\${title}&dates=\${startISO}/\${endISO}&details=\${details}\`;
      
      document.getElementById('addToCalendar').innerHTML = \`
        <a href="\${googleUrl}" target="_blank">📅 Add to Google Calendar</a>
      \`;
    }
  </script>
</body>
</html>`;
}

function renderNotFound() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found | joe</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .container { text-align: center; padding: 40px; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: #666; margin-bottom: 24px; }
    a { color: #111; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Scheduling page not found</h1>
    <p>This scheduling link may be invalid or the team member doesn't exist.</p>
    <a href="https://joe.coffee">← Back to joe.coffee</a>
  </div>
</body>
</html>`;
}

function renderError() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Error | joe</title>
  <style>body { font-family: sans-serif; text-align: center; padding: 50px; }</style>
</head>
<body>
  <h1>Something went wrong</h1>
  <p>Please try again later.</p>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
