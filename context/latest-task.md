## Implementation Plan

Task: Based on the below considerations, give the finalized schema for job runs and job events

### Description

- Want to make the job and job events standardized:

#### First about job:

- Find out those columns whose values are ambiguous and can be built or simply don't needed
- Don't need to store current stage into job, it will be handled by job events
- Instead of error message, store error json object which includes the message also but also other information for more context
- How many actual bullmq jobs are there, the job entries within the database should match exactly, no more or less; the DB job records should match the bullmq job states basically

#### Now about job events:

I want to make the job_run_events entity simpler and standardized, the purpose is now not just the run tracking but showing the progress with exact figures into UI, this includes predefined fix stages for every job (type + name whatever the deduped identification is) (the stages must be decided for every job), some stages may include numeric figures where as some may not

ex. fetching candles month by month chunks, so per tracking record represents a month chunk having numerical information where as some stages like preparing or auditing doesn't contain any numerical information

- Don't need the columns for metrics, multiple related columns like kind and level
  - Make sure to have minimal consistent columns for job events, whatever things can vary and dynamic should be within teh common json column, like the figures and numbers can vary depending on job type and stage

- The UI would display live progress based on the job events into the job table (add a column for progress that will reflect either stage on live basis or figures on live basis depending on the stage)
  - Other places where the progress can be displayed live add there also

- The job events table shouldn't include any raw message column, the message building should be done dynamically within code, the table should only include objective and fact information

### Context

- 

### Constraints

- Exclude the columns which are not needed for job and job events
- In case of stalled or older code, remove that completely and override by the new code
- For this task scope, give the finalized schema for job runs and job events, no need to implement the changes in codebase yet