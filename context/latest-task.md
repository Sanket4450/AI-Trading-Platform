## Implementation Plan

Task: Do the following task for webapp

### Description

- In case of Refresh missing months button, it should show a confirmation dialog for that action

- Go through for each such action button or trigger within webapp that does an important operation directly, the dialog should be come for every one of them

- Make sure to levarage existing common dialog if present otherwise build a such dialog and levarage that consistently

- Make sure it shouldn't show "Refresh missing months" tooltip or button for every instrument strait, in case some instrument aren't fetched anytime, so that action would fetch the instrument data from scratch so the action button and dialog should show something else, like this in case of different cases then show messages, tooltip, labels conditionally
  - Not too conditionally, you can group related things together

### Context

- 

### Constraints

- 