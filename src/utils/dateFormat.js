function getDateInArgentina(sourceDate) {
  return new Date(sourceDate.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
}

function formatDateInArgentina(date) {
  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

module.exports = {
  getDateInArgentina,
  formatDateInArgentina
};
