/**
 * CSV template for the cdm /reservables Add section. Columns are `name,type`;
 * the weekly schedule is NOT in the file — imported rows default to
 * all-available Mon-Sat and are edited afterwards on the schedule grid.
 */
export const RESERVABLE_CSV_TEMPLATE =
  "name,type\nCardinal Cinema,room\nCervantes Hall,room\nGlobal Classroom,room\nAV Projector,equipment\nWireless Microphone,equipment\n"
