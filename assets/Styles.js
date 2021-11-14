import { StyleSheet } from "react-native";

export default StyleSheet.create({
    container: {
        backgroundColor: '#ebebeb',
    },
    iconsContainer: {
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row'
    },
    iconStyle: {
        padding: 20
    },
    headerContainer: {
        height: '35%',
    },
    sectionContainer: {
        height: '35%',
    },
    footerContainer: {
        height: '30%',
    },
    text: {
        color: '#101010',
        fontSize: 24,
        fontWeight: 'bold',
    },
    smallLinkText: {
        color: 'blue',
        fontSize: 12,
        paddingLeft: 20
    },
    card: {
        width: 350,
        height: 100,
        borderRadius: 10,
        backgroundColor: '#101010',
        margin: 10,
        padding: 10,
        alignItems: 'center',
    },
    cardText: {
        fontSize: 18,
        color: '#ffd700',
        marginBottom: 5,
    },
    buttonContainer: {
        borderRadius: 5,
        padding: 20,
        paddingBottom: 0
    },
    buttonText: {
        fontSize: 20,
        color: 'black',
    },
    input: {
        height: 40,
        margin: 12,
        borderWidth: 1,
        padding: 10,
    },
});