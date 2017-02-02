var dao = require("./dao");
var HttpError = require("./errors").HttpError;

var enrollStudent = function* (student) {

    if (student.institutionShortCode && student.schoolCode && student.firstName &&
        student.lastName && student.dateOfBirth && student.gender && student.documents && student.documents.medicalForm
        && student.documents.tuitionForm) {
        delete student.studentId;
        var existingStudents = null;
        try {
            existingStudents = yield dao.getStudentsByBirthDateAndFirstName(new Date(student.dateOfBirth), student.firstName);
        } catch (err) {
            console.log("Error in getStudentByBirthDateAndFirstName", err);
            throw err;
        }
        if (existingStudents && existingStudents.length > 0) {
            console.log("Student with Birthdate and Firstname already exists", existingStudents.map(item => item.attrs));
            throw new HttpError(400, { err: "Student with Birthdate and Firstname already exists" });
        }
        var existingSchool = null;
        try {
            existingSchool = yield dao.getSchoolByShortCode(student.institutionShortCode, student.schoolCode);
        } catch (err) {
            console.log("Error in getSchoolByShortCode", err);
            throw err;
        }
        if (!existingSchool) {
            console.log("School with provided shortcode does not exist");
            throw new HttpError(400, { err: "School with provided shortcode does not exist" });
        }
        student.paymentInfo = {
            paymentStatus: "NOT_PAID"
        };
        student.enrollmentInfo = {
            isEnrolled: false,
            pastClassesEnrolled: [],
            classesEnrolled: []
        }
        var newStudent = null;
        try {
            var newStudent = yield dao.createStudent(student);
        } catch (err) {
            console.log("Error in createStudent", err);
            throw err;
        }
        if (!newStudent) {
            throw new HttpError(400, "Bad request");
        }
        return newStudent;
    } else {
        throw new HttpError(400, "Bad request");
    }

}

var updateStudentDetails = function* (student) {
    if (student && student.studentId) {
        var existingStudent = yield dao.getStudentByStudentId(student.studentId);
        if (!existingStudent) {
            throw new HttpError(400, "Student does not exist");
        }
        var updatedStudent = existingStudent;
        if (student.middlename) updatedStudent.middlename = student.middlename;
        if (student.lastname) updatedStudent.lastname = student.lastname;
        if (student.nickname) updatedStudent.nickname = student.nickname;
        if (student.cityOfBirth) updatedStudent.cityOfBirth = student.cityOfBirth;
        if (student.countryOfBirth) updatedStudent.countryOfBirth = student.countryOfBirth;
        if (student.stateOfBirth) updatedStudent.stateOfBirth = student.stateOfBirth;
        if (student.zip) updatedStudent.zip = student.zip;
        if (student.race) updatedStudent.race = student.race;
        if (student.gender) updatedStudent.gender = student.gender;
        if (student.extraInfo) updatedStudent.extraInfo = student.extraInfo;
        if (student.documents && student.documents.medicalForm) updatedStudent.documents.medicalForm = student.documents.medicalForm;
        if (student.documents && student.documents.tuitionForm) updatedStudent.documents.tuitionForm = student.documents.tuitionForm;

        yield dao.updatedStudent(updatedStudent);
    } else {
        throw new HttpError(400, "Bad request");
    }
}

var unenrollStudent = function* (student) {
    if (student && student.studentId) {
        var existingStudent = yield dao.getStudentByStudentId(student.studentId);
        if (!existingStudent) {
            throw new HttpError(400, "Student does not exist");
        }
        existingStudent.enrollmentInfo.isEnrolled = false;
        yield dao.updateStudent(updatedStudent);
    } else {
        throw new HttpError(400, "Bad request");
    }
}

var updatePaymentDetails = function* (studentId, paymentDetails) {
    // if (studentId && paymentDetails) {

    // } else {
    //     throw new HttpError(400, "Bad request");
    // }

}

var approvePaymentDetails = function* (studentId) {
    if (studentId) {
        var existingStudent = yield dao.getStudentByStudentId(studentId);
        if (!existingStudent) {
            throw new HttpError(400, "Bad request");
        }
        existingStudent.paymentInfo = {
            paymentStatus: "PAYMENT_CONFIRMED",
            confirmerAdminId: this.state.user.userId
        }
    }
}

//token to contain institutionShortCode and schoolCode
var getStudentsBySchoolCode = function* (schoolCode) {
    if (schoolCode) {
        var existingStudents = yield dao.getStudentsBySchoolCode(schoolCode);
        return existingStudents;
    } else {
        throw new HttpError(400, "Bad request");
    }
}

module.exports = {
    enrollStudent,
    updatePaymentDetails,
    approvePaymentDetails,
    getStudentsBySchoolCode,
    enrollStudent
}