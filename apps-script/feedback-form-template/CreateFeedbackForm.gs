/**
 * Builds an anonymous feedback form for a student project in one click.
 * Run createFeedbackForm() from the editor (select it in the function menu first).
 *
 * Design choices:
 * - No e-mail collection, so answers stay anonymous.
 * - Only three questions are required, to keep completion high.
 * - A short data-use note up front, and a closing message that says
 *   when answers are reviewed and where the resulting changes are shared.
 *
 * Form theme (colors, font, header image) cannot be set by Apps Script;
 * set it by hand in the form's "Customize theme" panel.
 */
function createFeedbackForm() {
  const form = FormApp.create('Project feedback (template)');
  form.setDescription(
    'This takes about 4 minutes. Answers are anonymous and are read only to improve how the project works. ' +
    'We review them once a month and share what changes as a result.'
  );
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);
  form.setConfirmationMessage('Thank you! We review answers monthly and post the resulting changes in the project channel.');

  // 1. About you
  form.addPageBreakItem().setTitle('About you');
  form.addMultipleChoiceItem()
    .setTitle('How long have you been in the project?')
    .setChoiceValues(['Less than 3 months', '3 to 6 months', 'More than 6 months'])
    .setRequired(true);
  form.addCheckboxItem()
    .setTitle('Which activities do you take part in?')
    .setChoiceValues(['Research', 'Hands-on workstream', 'Outreach', 'Events', 'Writing and funding']);

  // 2. Overall
  form.addPageBreakItem().setTitle('Overall');
  form.addScaleItem()
    .setTitle('Overall, how well is the project working for you?')
    .setBounds(1, 5).setLabels('Not at all', 'Very well')
    .setRequired(true);
  form.addParagraphTextItem().setTitle('What is working well and should not change?');

  // 3. Organization and tools
  form.addPageBreakItem().setTitle('Organization and tools');
  form.addScaleItem()
    .setTitle('How easy is it to find the file you need in the shared Drive?')
    .setBounds(1, 5).setLabels('Very hard', 'Very easy');
  form.addMultipleChoiceItem()
    .setTitle('When you are unsure where to save a file, what do you do?')
    .setChoiceValues(['I check the quick guide', 'I ask someone', 'I use the inbox folder', 'I save it anywhere'])
    .showOtherOption(true);

  // 4. Communication and routine
  form.addPageBreakItem().setTitle('Communication and routine');
  form.addScaleItem()
    .setTitle('Do you know what is happening each week and what is expected from you?')
    .setBounds(1, 5).setLabels('Rarely', 'Always');

  // 5. Ideas
  form.addPageBreakItem().setTitle('Ideas');
  form.addParagraphTextItem()
    .setTitle('If you could change one thing in how the project is organized, what would it be?')
    .setRequired(true);

  Logger.log('Edit: ' + form.getEditUrl());
  Logger.log('Share: ' + form.getPublishedUrl());
}
