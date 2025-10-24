# Email Template Variables - Quick Reference Guide

## 📝 How to Use Variables in Your Email Templates

When creating email templates, you can insert dynamic variables that will be automatically replaced with actual data when sending emails.

---

## 🎨 Variable Formats Supported

You can use variables in **THREE different formats** - all work the same way:

### Format 1: Simple (Recommended - Easiest)
Use **single braces** with simple names:
```
{firstName} {lastName} {email} {conferenceName} {conferenceDate}
```

### Format 2: Nested (Organized)
Use **double braces** with dot notation:
```
{{client.firstName}} {{client.email}} {{conference.name}} {{conference.venue}}
```

### Format 3: Underscore (Alternative)
Use **double braces** with underscores:
```
{{client_name}} {{client_email}} {{conference_name}} {{conference_venue}}
```

**💡 Tip:** Use Format 1 (simple) - it's the easiest and matches the UI buttons!

---

## 📋 Complete Variable List

### 👤 Client Variables

| Variable | Format 1 (Simple) | Format 2 (Nested) | Format 3 (Underscore) | Example Output |
|----------|-------------------|-------------------|-----------------------|----------------|
| Full Name | `{name}` | `{{client.name}}` | `{{client_name}}` | John Doe |
| First Name | `{firstName}` | `{{client.firstName}}` | `{{client_first_name}}` | John |
| Last Name | `{lastName}` | `{{client.lastName}}` | `{{client_last_name}}` | Doe |
| Email | `{email}` | `{{client.email}}` | `{{client_email}}` | john@example.com |
| Phone | `{phone}` | `{{client.phone}}` | `{{client_phone}}` | +1234567890 |
| Country | `{country}` | `{{client.country}}` | `{{client_country}}` | United States |
| Organization | `{organization}` | `{{client.organization}}` | `{{client_organization}}` | Example Corp |
| Position | `{position}` | `{{client.position}}` | `{{client_position}}` | Manager |

### 🎪 Conference Variables

| Variable | Format 1 (Simple) | Format 2 (Nested) | Format 3 (Underscore) | Example Output |
|----------|-------------------|-------------------|-----------------------|----------------|
| Conference Name | `{conferenceName}` | `{{conference.name}}` | `{{conference_name}}` | Tech Conference 2024 |
| Venue | `{conferenceVenue}` | `{{conference.venue}}` | `{{conference_venue}}` | Convention Center |
| Date Range | `{conferenceDate}` | `{{conference.dateRange}}` | `{{conference_date}}` | June 15, 2024 to June 17, 2024 |
| Start Date | `{conferenceStartDate}` | `{{conference.startDate}}` | `{{conference_start_date}}` | June 15, 2024 |
| End Date | `{conferenceEndDate}` | `{{conference.endDate}}` | `{{conference_end_date}}` | June 17, 2024 |
| Abstract Deadline | `{abstractDeadline}` | `{{conference.abstractDeadline}}` | `{{abstract_deadline}}` | May 15, 2024 |
| Registration Deadline | `{registrationDeadline}` | `{{conference.registrationDeadline}}` | `{{registration_deadline}}` | June 1, 2024 |
| Website | `{conferenceWebsite}` | `{{conference.website}}` | `{{conference_website}}` | https://techconf.com |
| Description | `{conferenceDescription}` | `{{conference.description}}` | `{{conference_description}}` | Annual tech event |

### 📅 System Variables

| Variable | Format 1 (Simple) | Format 2 (Nested) | Example Output |
|----------|-------------------|-------------------|----------------|
| Current Date | `{currentDate}` | `{{system.currentDate}}` | October 24, 2025 |
| Current Year | `{currentYear}` | `{{system.currentYear}}` | 2025 |

---

## 💡 Example Templates

### Example 1: Initial Invitation (Using Simple Format)

**Subject:**
```
Invitation to {conferenceName}
```

**Body:**
```html
<p>Dear {firstName} {lastName},</p>

<p>You are cordially invited to participate in <strong>{conferenceName}</strong>!</p>

<h3>Conference Details:</h3>
<ul>
  <li><strong>Venue:</strong> {conferenceVenue}</li>
  <li><strong>Date:</strong> {conferenceDate}</li>
  <li><strong>Website:</strong> <a href="{conferenceWebsite}">{conferenceWebsite}</a></li>
</ul>

<p><strong>Important Deadlines:</strong></p>
<ul>
  <li>Abstract Submission: {abstractDeadline}</li>
  <li>Registration: {registrationDeadline}</li>
</ul>

<p>We look forward to your participation!</p>

<p>Best regards,<br>
Conference Organizing Committee</p>
```

**Output:**
```
Dear John Doe,

You are cordially invited to participate in Tech Conference 2024!

Conference Details:
• Venue: Convention Center
• Date: June 15, 2024 to June 17, 2024
• Website: https://techconf.com

Important Deadlines:
• Abstract Submission: May 15, 2024
• Registration: June 1, 2024

We look forward to your participation!

Best regards,
Conference Organizing Committee
```

---

### Example 2: Abstract Submission Reminder (Using Nested Format)

**Subject:**
```
Abstract Submission Reminder - {{conference.name}}
```

**Body:**
```html
<p>Dear {{client.firstName}},</p>

<p>This is a friendly reminder to submit your abstract for <strong>{{conference.name}}</strong>.</p>

<p><strong>Deadline:</strong> {{conference.abstractDeadline}}<br>
<strong>Conference Date:</strong> {{conference.dateRange}}<br>
<strong>Venue:</strong> {{conference.venue}}</p>

<p>Submit your abstract at: <a href="{{conference.website}}">{{conference.website}}</a></p>

<p>Best regards,<br>Conference Team</p>
```

---

### Example 3: Registration Reminder (Using Mixed Formats)

**Subject:**
```
{firstName}, Complete Your Registration for {conferenceName}
```

**Body:**
```html
<p>Hi {firstName},</p>

<p>Congratulations on submitting your abstract for {{conference.name}}!</p>

<p>Please complete your registration before {{conference_registration_deadline}}.</p>

<p><strong>Conference Details:</strong></p>
<ul>
  <li>Name: {conferenceName}</li>
  <li>Date: {{conference.dateRange}}</li>
  <li>Venue: {{conference_venue}}</li>
</ul>

<p><a href="{conferenceWebsite}">Register Now</a></p>

<p>Best regards,<br>Conference Team</p>
```

---

## 🎨 Styling Tips

### Use HTML for Rich Formatting:

```html
<!-- Headings -->
<h2 style="color: #2563eb;">Welcome to the Conference!</h2>

<!-- Styled paragraphs -->
<p style="font-size: 16px; line-height: 1.6;">Dear {firstName},</p>

<!-- Buttons -->
<a href="{conferenceWebsite}" 
   style="background-color: #2563eb; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 6px; 
          display: inline-block;">
  Register Now
</a>

<!-- Lists -->
<ul style="list-style-type: none; padding-left: 0;">
  <li>✓ Venue: {conferenceVenue}</li>
  <li>✓ Date: {conferenceDate}</li>
</ul>

<!-- Dividers -->
<hr style="border: none; border-top: 2px solid #e5e7eb; margin: 30px 0;">

<!-- Footer -->
<p style="font-size: 12px; color: #6b7280;">
  {conferenceName} | {conferenceWebsite}
</p>
```

---

## ✅ Best Practices

1. **Always include client name:** `{firstName}` or `{name}` makes emails personal
2. **Include conference name:** `{conferenceName}` provides context
3. **Add important dates:** `{abstractDeadline}`, `{registrationDeadline}`, `{conferenceDate}`
4. **Include website link:** `{conferenceWebsite}` for easy access
5. **Test before sending:** Preview your template to verify variables

---

## ⚠️ Common Mistakes to Avoid

❌ **Don't use:** `{ClientName}` (wrong capitalization)  
✅ **Use:** `{firstName}` or `{name}`

❌ **Don't use:** `{conference-name}` (dashes not supported)  
✅ **Use:** `{conferenceName}` or `{{conference.name}}`

❌ **Don't use:** `{ name }` (spaces inside braces)  
✅ **Use:** `{name}` (no spaces)

❌ **Don't forget:** To assign the template to your conference!

---

## 🔍 Troubleshooting

### Variables Still Showing as {name}?

1. **Check template assignment:** Is the template assigned to the conference?
2. **Check stage value:** Does the template have the correct stage?
   - Initial Invitation: `stage = 'initial_invitation'`
   - Abstract Submission: `stage = 'abstract_submission'`
   - Registration: `stage = 'registration'`
3. **Check spelling:** Variable names are case-sensitive
4. **Check backend logs:** Look for "✅ Using assigned template" message

### Template Not Being Used?

1. Check if conference has `initialTemplateId`, `stage1TemplateId`, `stage2TemplateId` set
2. Verify the template exists and is active
3. Check backend console logs for template selection messages

---

## 🎊 You're All Set!

Your email templates will now:
- ✅ Use YOUR custom content
- ✅ Replace ALL variables correctly
- ✅ Format dates beautifully
- ✅ Look professional

Happy emailing! 📧✨

