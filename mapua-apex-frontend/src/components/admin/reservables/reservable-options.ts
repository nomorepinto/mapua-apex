/**
 * CSV template for the cdm /reservables Add section. Columns are
 * `name,type,room_type`; room rows need a room_type (function_room, classroom,
 * multi_purpose_hall, open_space, laboratory), equipment rows leave it blank.
 * The weekly schedule is NOT in the file — imported rows default to
 * all-available Mon-Sat and are edited afterwards on the schedule grid.
 */
export const RESERVABLE_CSV_TEMPLATE =
  "name,type,room_type\nCardinal Cinema,room,function_room\nCervantes Hall,room,multi_purpose_hall\nN101,room,classroom\nAV Projector,equipment,\nWireless Microphone,equipment,\n"
