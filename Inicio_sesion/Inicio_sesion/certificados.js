document.addEventListener('DOMContentLoaded', function() {
    var generateButtons = document.querySelectorAll('.generate-button');

    generateButtons.forEach(button => {
        button.addEventListener('click', function() {
            var type = this.getAttribute('data-type');
            var studentData = getStudentDataFromURL();

            if (studentData) {
                generatePDF(type, studentData);
            } else {
                console.error('No se encontraron datos del estudiante.');
            }
        });
    });

    function getStudentDataFromURL() {
        var urlParams = new URLSearchParams(window.location.search);
        var studentData = urlParams.get('student');
        if (studentData) {
            return JSON.parse(decodeURIComponent(studentData));
        } else {
            return null;
        }
    }

    function generatePDF(type, studentData) {
        fetch(`/generar-pdf/${type}/${studentData.id}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error al generar el PDF');
                }
                return response.blob();
            })
            .then(blob => {
                var url = window.URL.createObjectURL(blob);
                
                // Crear un enlace temporal para forzar la descarga
                var a = document.createElement('a');
                a.href = url;
                a.download = `${type}.pdf`; // Nombre del archivo sugerido
                document.body.appendChild(a); // Añadir al DOM para asegurarnos de que funcione
                a.click();
                
                // Limpiar
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            })
            .catch(error => {
                console.error('Error al generar el PDF:', error);
            });
    }
});
